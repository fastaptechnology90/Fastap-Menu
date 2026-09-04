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
