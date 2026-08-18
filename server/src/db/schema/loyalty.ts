import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { customersTable } from "./customers";

export const loyaltyProgramsTable = pgTable("loyalty_programs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().unique().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  type: text("type").notNull().default("points"),
  pointsPerDollar: numeric("points_per_dollar", { precision: 5, scale: 2 }).notNull().default("1"),
  cashbackPercent: numeric("cashback_percent", { precision: 5, scale: 2 }).notNull().default("5"),
  stampsForReward: integer("stamps_for_reward").notNull().default(10),
  rewardValue: numeric("reward_value", { precision: 10, scale: 2 }).notNull().default("5"),
  expiryDays: integer("expiry_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const loyaltyTransactionsTable = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  type: text("type").notNull(),
  points: integer("points").notNull().default(0),
  cashback: numeric("cashback", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
