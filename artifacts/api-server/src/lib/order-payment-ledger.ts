import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, financeTransactionsTable, cashShiftsTable } from "@workspace/db";
import { accrueStaffEarningsForOrder } from "./staff-earnings.js";
import { allocateInvoiceNumber } from "./invoice-series.js";

/**
 * Records a paid order in the finance ledger.
 *
 * This is the single place the web panel and the mobile apps both go through, so
 * Finance and the Cash Counter show the same money no matter who collected it.
 * Before this existed only the web `PUT /orders/:id` path wrote a ledger row, so
 * every payment a waiter took in the app was invisible in Finance (Revenue said
 * ₹2.5k while Finance said ₹0).
 *
 * Safe to call more than once for the same order — the duplicate guard keeps
 * exactly one income row per order, and it never throws: a ledger problem must
 * not fail the payment the caller just recorded.
 */
export async function recordOrderPaymentInLedger(opts: {
  restaurantId: number;
  order: typeof ordersTable.$inferSelect;
  method?: string | null;
  reference?: string | null;
  performedBy?: string | null;
}): Promise<void> {
  const { restaurantId, order } = opts;
  try {
    const amount = String(parseFloat(String(order.total ?? "0")).toFixed(2));
    const method = (opts.method || order.paymentMethod || "cash") as string;

    // The moment money is booked is the moment a tax invoice exists, so the number is
    // drawn here and nowhere else. Doing it at the point the bill was merely displayed
    // burnt numbers on orders that were never paid, leaving holes in a series that has
    // to be consecutive.
    const invoiceNumber = await allocateInvoiceNumber(restaurantId, order);
    if (invoiceNumber) order.invoiceNumber = invoiceNumber;

    // The server who closed the table earns on this order the moment it is paid. Doing it
    // here — not at the ledger's duplicate guard below — means an order whose income row
    // already exists still accrues, and it runs for every payment path that books money.
    await accrueStaffEarningsForOrder({ restaurantId, order });

    const [dup] = await db.select({ id: financeTransactionsTable.id })
      .from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.orderId, order.id),
        eq(financeTransactionsTable.type, "income"),
      ))
      .limit(1);
    if (dup) return;

    await db.insert(financeTransactionsTable).values({
      restaurantId,
      type: "income",
      category: "order_payment",
      description: `Order #${order.id}${order.tableName ? ` · ${order.tableName}` : ""} — ${method}`,
      amount,
      paymentMethod: method,
      reference: (opts.reference || order.invoiceNumber || null) as string | null,
      orderId: order.id,
      performedBy: opts.performedBy ?? null,
    });

    // Cash lands in the drawer, so the open shift has to reflect it or the
    // Cash Counter's expected total will never match the count.
    if (method === "cash") {
      const [shift] = await db.select().from(cashShiftsTable)
        .where(and(
          eq(cashShiftsTable.restaurantId, restaurantId),
          eq(cashShiftsTable.status, "open"),
        ))
        .orderBy(desc(cashShiftsTable.openedAt))
        .limit(1);
      if (shift) {
        const newSales = (parseFloat(String(shift.cashSales ?? "0")) + parseFloat(amount)).toFixed(2);
        await db.update(cashShiftsTable).set({ cashSales: newSales }).where(eq(cashShiftsTable.id, shift.id));
      }
    }
  } catch (e) {
    console.error("finance ledger write failed for order", order.id, e);
  }
}

/**
 * Books money collected outside the order flow — spa bookings, banquet
 * advances, hotel room folios. Those panels each took payments that never
 * reached Finance or the Cash Counter, so the owner's ledger only ever showed
 * restaurant orders.
 *
 * De-duplicates on `reference` (e.g. "SPA-6"), so re-saving the same booking
 * books the money once.
 */
export async function recordAncillaryPaymentInLedger(opts: {
  restaurantId: number;
  reference: string;
  amount: string | number;
  category: string;
  description: string;
  method?: string | null;
  performedBy?: string | null;
}): Promise<void> {
  const { restaurantId, reference } = opts;
  try {
    const amount = Number(opts.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const [dup] = await db.select({ id: financeTransactionsTable.id })
      .from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.restaurantId, restaurantId),
        eq(financeTransactionsTable.reference, reference),
        eq(financeTransactionsTable.type, "income"),
      ))
      .limit(1);
    if (dup) return;

    const method = opts.method || "cash";
    await db.insert(financeTransactionsTable).values({
      restaurantId,
      type: "income",
      category: opts.category,
      description: opts.description,
      amount: amount.toFixed(2),
      paymentMethod: method,
      reference,
      orderId: null,
      performedBy: opts.performedBy ?? null,
    });

    if (method === "cash") {
      const [shift] = await db.select().from(cashShiftsTable)
        .where(and(
          eq(cashShiftsTable.restaurantId, restaurantId),
          eq(cashShiftsTable.status, "open"),
        ))
        .orderBy(desc(cashShiftsTable.openedAt))
        .limit(1);
      if (shift) {
        const newSales = (parseFloat(String(shift.cashSales ?? "0")) + amount).toFixed(2);
        await db.update(cashShiftsTable).set({ cashSales: newSales }).where(eq(cashShiftsTable.id, shift.id));
      }
    }
  } catch (e) {
    console.error("ancillary ledger write failed for", reference, e);
  }
}

/**
 * Books money handed back on an order that has already been paid for — a partial refund,
 * or a line voided or comped after the bill was settled.
 *
 * Only a FULL refund used to reach the ledger. A partial one wrote the amount onto the
 * order metadata and stopped there, and voiding a line on a settled bill quietly rewrote
 * the order total with no matching row at all. Either way the income row kept the whole
 * original amount, so Finance held money the guest had been given back, and Revenue (which
 * reads the order) and Finance (which reads the ledger) stopped agreeing.
 *
 * Never books more than is left un-refunded on the order, so calling it twice for the same
 * money — or following a partial refund with a cancellation — cannot double-count.
 * Returns what it actually booked.
 */
export async function recordOrderRefundInLedger(opts: {
  restaurantId: number;
  order: typeof ordersTable.$inferSelect;
  amount: number;
  reason?: string | null;
  /** Shown in the ledger description, e.g. "refunded", "line voided". */
  what?: string;
}): Promise<number> {
  const { restaurantId, order } = opts;
  try {
    const requested = Math.round(Number(opts.amount) * 100) / 100;
    if (!Number.isFinite(requested) || requested <= 0) return 0;

    const [income] = await db.select().from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.orderId, order.id),
        eq(financeTransactionsTable.type, "income"),
      ))
      .limit(1);
    if (!income) return 0; // nothing was ever booked for this order

    const priorRefunds = await db.select({ amount: financeTransactionsTable.amount })
      .from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.orderId, order.id),
        eq(financeTransactionsTable.type, "refund"),
      ));
    const alreadyBooked = priorRefunds.reduce((t, r) => t + parseFloat(String(r.amount ?? 0)), 0);
    const refundable = Math.round((parseFloat(String(income.amount)) - alreadyBooked) * 100) / 100;
    const amount = Math.min(requested, refundable);
    if (amount <= 0) return 0;

    const method = income.paymentMethod || "cash";
    const why = opts.reason ? ` — ${opts.reason}` : "";
    await db.insert(financeTransactionsTable).values({
      restaurantId,
      type: "refund",
      category: "order_refund",
      description: `Order #${order.id} ${opts.what ?? "refunded"}${why}`,
      amount: amount.toFixed(2),
      paymentMethod: method,
      reference: income.reference,
      orderId: order.id,
      performedBy: income.performedBy,
    });

    // Cash going back out of the drawer has to come off the open shift too.
    if (method === "cash") {
      const [shift] = await db.select().from(cashShiftsTable)
        .where(and(
          eq(cashShiftsTable.restaurantId, restaurantId),
          eq(cashShiftsTable.status, "open"),
        ))
        .orderBy(desc(cashShiftsTable.openedAt))
        .limit(1);
      if (shift) {
        const newSales = (parseFloat(String(shift.cashSales ?? "0")) - amount).toFixed(2);
        await db.update(cashShiftsTable).set({ cashSales: newSales }).where(eq(cashShiftsTable.id, shift.id));
      }
    }
    return amount;
  } catch (e) {
    console.error("finance ledger refund failed for order", order.id, e);
    return 0;
  }
}

/**
 * Reverses a booked payment when a paid order is cancelled or refunded.
 *
 * Writes a matching "refund" row rather than deleting the income one, so the
 * ledger keeps the full history — and the Finance summary nets refunds off the
 * income. Without this, cancelling a paid order dropped it from Revenue but
 * left the money sitting in Finance forever.
 *
 * Idempotent: a second cancel of the same order books nothing extra.
 */
export async function reverseOrderPaymentInLedger(opts: {
  restaurantId: number;
  order: typeof ordersTable.$inferSelect;
  reason?: string | null;
}): Promise<void> {
  const [income] = await db.select({ amount: financeTransactionsTable.amount })
    .from(financeTransactionsTable)
    .where(and(
      eq(financeTransactionsTable.orderId, opts.order.id),
      eq(financeTransactionsTable.type, "income"),
    ))
    .limit(1);
  if (!income) return; // nothing was ever booked for this order

  // Ask for the whole thing; the helper books only what is still un-refunded, so an order
  // that was already partly refunded reverses the remainder rather than the full amount
  // twice, and a second cancellation books nothing.
  await recordOrderRefundInLedger({
    restaurantId: opts.restaurantId,
    order: opts.order,
    amount: parseFloat(String(income.amount)),
    reason: opts.reason ?? "reversed",
    what: "cancelled",
  });
}
