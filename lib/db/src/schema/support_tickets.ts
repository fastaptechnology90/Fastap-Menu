import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { guestUsersTable } from "./guest_users";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "set null" }),
  guestUserId: integer("guest_user_id").references(() => guestUsersTable.id, { onDelete: "set null" }),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  channel: text("channel").notNull().default("chat"),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  slaDeadline: timestamp("sla_deadline", { withTimezone: true }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
