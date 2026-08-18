import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const guestSessionsTable = pgTable("guest_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  shareCode: text("share_code"),
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "cascade" }),
  sessionType: text("session_type").notNull().default("personal"),
  tableId: integer("table_id"),
  tableName: text("table_name"),
  roomNumber: text("room_number"),
  sectionName: text("section_name"),
  entryMethod: text("entry_method"),
  serviceMode: text("service_mode"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").default("Asia/Kolkata"),
  branchId: integer("branch_id"),
  cartSnapshot: jsonb("cart_snapshot").notNull().default([]),
  deviceIds: jsonb("device_ids").notNull().default([]),
  memberCount: integer("member_count").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuestSession = typeof guestSessionsTable.$inferSelect;
