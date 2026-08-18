import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { tablesMapTable } from "./tables_map";

export const tableSeatingRequestsTable = pgTable("table_seating_requests", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("pending"),
  token: text("token").notNull().unique(),
  fromTableId: integer("from_table_id").references(() => tablesMapTable.id, { onDelete: "set null" }),
  toTableId: integer("to_table_id").references(() => tablesMapTable.id, { onDelete: "set null" }),
  targetTableIds: jsonb("target_table_ids").default([]),
  partySize: integer("party_size").notNull().default(2),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  guestUserId: integer("guest_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TableSeatingRequest = typeof tableSeatingRequestsTable.$inferSelect;
