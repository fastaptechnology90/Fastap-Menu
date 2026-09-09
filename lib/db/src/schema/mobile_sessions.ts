import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

/**
 * Signed-in kitchen, waiter and housekeeping handsets.
 *
 * These lived in an in-memory Map, so every deploy and every crash signed out the kitchen
 * display and all the waiter handhelds at once, mid-service — and the login rate limit
 * then locked them out again as they all signed back in together. A session is a fact
 * about a device, not a fact about a process, so it belongs in the database.
 */
export const mobileSessionsTable = pgTable("mobile_sessions", {
  token: text("token").primaryKey(),
  staffId: integer("staff_id").notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** The whole session as the app was handed it, so a restart restores it unchanged. */
  session: jsonb("session").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  byStaff: index("mobile_sessions_staff_idx").on(t.staffId),
}));

export type MobileSessionRow = typeof mobileSessionsTable.$inferSelect;
