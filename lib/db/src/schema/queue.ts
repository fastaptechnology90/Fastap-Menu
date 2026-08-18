import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const queueEntriesTable = pgTable("queue_entries", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  tokenNumber: integer("token_number").notNull(),
  guestName: text("guest_name").notNull(),
  guestPhone: text("guest_phone"),
  partySize: integer("party_size").notNull().default(1),
  publicToken: text("public_token"),
  notifyVia: text("notify_via").default("app"),
  priority: text("priority").default("normal"),
  queueType: text("queue_type").default("dining"),
  status: text("status").notNull().default("waiting"), // "waiting" | "called" | "seated" | "cancelled" | "no_show"
  tablePreference: text("table_preference"),
  specialRequests: text("special_requests"),
  estimatedWait: integer("estimated_wait").notNull().default(15),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  seatedAt: timestamp("seated_at", { withTimezone: true }),
  calledAt: timestamp("called_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QueueEntry = typeof queueEntriesTable.$inferSelect;
