import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const notificationsLogTable = pgTable("notifications_log", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("push"), // "push" | "sms" | "whatsapp" | "email" | "internal"
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipient: text("recipient"),
  recipientType: text("recipient_type").notNull().default("all"), // "all" | "staff" | "customer" | "specific"
  status: text("status").notNull().default("sent"), // "sent" | "delivered" | "failed" | "pending"
  metadata: jsonb("metadata").notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationLog = typeof notificationsLogTable.$inferSelect;
