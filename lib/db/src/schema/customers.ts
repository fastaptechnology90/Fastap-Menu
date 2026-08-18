import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
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
  birthday: text("birthday"),
  anniversary: text("anniversary"),
  preferences: jsonb("preferences").default({}),
  favoriteItems: jsonb("favorite_items").default([]),
  walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).default("0"),
  isVip: boolean("is_vip").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
