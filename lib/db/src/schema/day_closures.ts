import { pgTable, text, serial, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

/**
 * A business day that has been closed by a Z reading.
 *
 * The Z reading used to be a plain GET that re-derived the day's figures every time it was
 * asked, so it was identical to the X reading, could be taken twenty times with the same
 * answer, and locked nothing — yesterday's takings could still move after the manager had
 * signed them off. A Z is the close of a business day: it happens once, it freezes the
 * numbers that were true at that moment, and every later read of that day returns the
 * frozen copy rather than a fresh calculation.
 */
export const dayClosuresTable = pgTable("day_closures", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  /** The venue's own business day, "YYYY-MM-DD" — not a UTC calendar day. */
  businessDate: text("business_date").notNull(),
  /** Sequential per venue, so a missing Z is visible as a gap. */
  zNumber: integer("z_number").notNull(),
  /** The whole day-end report as it stood at the moment of closing. */
  report: jsonb("report").notNull().default({}),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  closedBy: text("closed_by"),
}, t => ({
  // One close per venue per day. A second attempt must be refused, not stack up.
  oneClosurePerDay: uniqueIndex("day_closures_restaurant_date_uq").on(t.restaurantId, t.businessDate),
}));

export type DayClosure = typeof dayClosuresTable.$inferSelect;
