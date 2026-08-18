import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpend: numeric("total_spend", { precision: 10, scale: 2 }).notNull().default("0"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  lastVisit: timestamp("last_visit", { withTimezone: true }),
  segment: text("segment").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Customer = typeof customersTable.$inferSelect;
