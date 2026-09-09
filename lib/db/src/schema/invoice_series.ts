import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

/**
 * The venue's own tax-invoice counter, one series per financial year.
 *
 * Invoice numbers used to be derived from the global order id, so a venue's series skipped
 * every number burnt by a cancelled order and by every OTHER venue's orders — and a payment
 * that failed still took a number with it. A GST invoice series has to be consecutive with
 * every number accounted for, so the number is now allocated from here, once, at the moment
 * an order is actually settled.
 */
export const invoiceSeriesTable = pgTable("invoice_series", {
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  /** Indian financial year the series belongs to, e.g. "2026-27". Numbering restarts each April. */
  financialYear: text("financial_year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
}, t => ({
  pk: primaryKey({ columns: [t.restaurantId, t.financialYear] }),
}));

export type InvoiceSeries = typeof invoiceSeriesTable.$inferSelect;
