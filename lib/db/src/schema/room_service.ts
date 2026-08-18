import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const DEFAULT_ROOM_CONTROLS = {
  ac: { on: true, temp: 22, mode: "cool" as const },
  lights: { on: true, brightness: 70 },
  curtains: { open: 60 },
  tv: { on: false, channel: 1, volume: 35 },
  dnd: false,
  cleaningStatus: "clean" as const,
};

export const roomServiceRequestsTable = pgTable("room_service_requests", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  roomNumber: text("room_number").notNull(),
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  type: text("type").notNull().default("food"), // "food" | "laundry" | "housekeeping" | "maintenance" | "checkout"
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "in_progress" | "completed" | "cancelled"
  items: jsonb("items").notNull().default([]),
  notes: text("notes"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("room_bill"),
  assignedTo: text("assigned_to"),
  estimatedTime: integer("estimated_time").notNull().default(30),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hotelRoomsTable = pgTable("hotel_rooms", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  type: text("type").notNull().default("standard"),
  floor: integer("floor").notNull().default(1),
  status: text("status").notNull().default("vacant"), // "vacant" | "occupied" | "cleaning" | "maintenance" | "reserved"
  guestName: text("guest_name"),
  guestPhone: text("guest_phone"),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  notes: text("notes"),
  roomControls: jsonb("room_controls").notNull().default(DEFAULT_ROOM_CONTROLS),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RoomServiceRequest = typeof roomServiceRequestsTable.$inferSelect;
export type HotelRoom = typeof hotelRoomsTable.$inferSelect;
