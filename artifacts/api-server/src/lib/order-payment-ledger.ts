import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, financeTransactionsTable, cashShiftsTable } from "@workspace/db";

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
  const { restaurantId, order } = opts;
  try {
    const [income] = await db.select().from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.orderId, order.id),
        eq(financeTransactionsTable.type, "income"),
      ))
      .limit(1);
    if (!income) return; // nothing was ever booked for this order

    const [already] = await db.select({ id: financeTransactionsTable.id })
      .from(financeTransactionsTable)
      .where(and(
        eq(financeTransactionsTable.orderId, order.id),
        eq(financeTransactionsTable.type, "refund"),
      ))
      .limit(1);
    if (already) return;

    const method = income.paymentMethod || "cash";
    await db.insert(financeTransactionsTable).values({
      restaurantId,
      type: "refund",
      category: "order_refund",
      description: `Order #${order.id} cancelled — ${opts.reason || "reversed"}`,
      amount: income.amount,
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
        const newSales = (parseFloat(String(shift.cashSales ?? "0")) - parseFloat(String(income.amount))).toFixed(2);
        await db.update(cashShiftsTable).set({ cashSales: newSales }).where(eq(cashShiftsTable.id, shift.id));
      }
    }
  } catch (e) {
    console.error("finance ledger reversal failed for order", order.id, e);
  }
}
