import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const staffCommissionsTable = pgTable("staff_commissions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id"),
  staffName: text("staff_name").notNull(),
  staffRole: text("staff_role").notNull(),
  type: text("type").notNull().default("sales"), // "sales" | "tip" | "incentive" | "penalty"
  orderId: integer("order_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  description: text("description"),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "paid" | "rejected"
  paidAt: timestamp("paid_at", { withTimezone: true }),
  month: text("month"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(),
  message: text("message").notNull(),
  messageType: text("message_type").notNull().default("text"), // "text" | "order" | "alert" | "task"
  channel: text("channel").notNull().default("general"), // "general" | "kitchen" | "waiter" | "manager"
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffCommission = typeof staffCommissionsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
