import { eq, sql } from "drizzle-orm";
import { db, ordersTable, invoiceSeriesTable } from "@workspace/db";
import { financialYearOf, formatInvoiceNumber } from "./paymentLogic.js";

/**
 * Hand an order the next number in its venue's own invoice series.
 *
 * The number used to be derived from the global order id — `INV-SG1-2026-00545` for order
 * 545 — so a venue's series skipped every number burnt by one of its own cancelled orders
 * and by every other venue's orders as well. It was also handed out on sight: merely
 * opening the invoice for an order, including one whose payment had just failed, minted a
 * number and stored it. A GST series has to be consecutive with every number accounted
 * for, so a number is drawn only when an order is actually settled, and only once.
 *
 * The counter moves inside a single statement, so two cashiers settling at the same instant
 * cannot both be handed the same number.
 */
export async function allocateInvoiceNumber(
  restaurantId: number,
  order: { id: number; invoiceNumber?: string | null; createdAt?: Date | string | null },
): Promise<string | null> {
  if (order.invoiceNumber) return order.invoiceNumber;
  try {
    const raisedAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const financialYear = financialYearOf(Number.isNaN(raisedAt.getTime()) ? new Date() : raisedAt);

    const [row] = await db
      .insert(invoiceSeriesTable)
      .values({ restaurantId, financialYear, lastNumber: 1 })
      .onConflictDoUpdate({
        target: [invoiceSeriesTable.restaurantId, invoiceSeriesTable.financialYear],
        set: { lastNumber: sql`${invoiceSeriesTable.lastNumber} + 1` },
      })
      .returning();

    const invoiceNumber = formatInvoiceNumber(restaurantId, financialYear, row.lastNumber);
    await db.update(ordersTable).set({ invoiceNumber }).where(eq(ordersTable.id, order.id));
    return invoiceNumber;
  } catch (e) {
    // Numbering must never be the thing that fails a payment the guest has already made.
    console.error("invoice number allocation failed for order", order.id, e);
    return null;
  }
}
