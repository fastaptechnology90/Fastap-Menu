import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const financeTransactionsTable = pgTable("finance_transactions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "income" | "expense" | "transfer" | "refund"
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  reference: text("reference"),
  orderId: integer("order_id"),
  performedBy: text("performed_by"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashShiftsTable = pgTable("cash_shifts", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  staffName: text("staff_name").notNull(),
  staffRole: text("staff_role").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingBalance: numeric("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 10, scale: 2 }),
  expectedBalance: numeric("expected_balance", { precision: 10, scale: 2 }),
  cashSales: numeric("cash_sales", { precision: 10, scale: 2 }).notNull().default("0"),
  cashExpenses: numeric("cash_expenses", { precision: 10, scale: 2 }).notNull().default("0"),
  denominations: text("denominations"),
  notes: text("notes"),
  status: text("status").notNull().default("open"), // "open" | "closed" | "pending_review"
  mismatchAlert: boolean("mismatch_alert").notNull().default(false),
});

export type FinanceTransaction = typeof financeTransactionsTable.$inferSelect;
export type CashShift = typeof cashShiftsTable.$inferSelect;
