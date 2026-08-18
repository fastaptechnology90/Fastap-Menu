import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { guestUsersTable } from "./guest_users";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  guestUserId: integer("guest_user_id").notNull().references(() => guestUsersTable.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  walletType: text("wallet_type").notNull().default("main"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
