import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const spaServicesTable = pgTable("spa_services", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("massage"), // "massage" | "facial" | "body" | "hair" | "bar" | "beverage"
  description: text("description"),
  duration: integer("duration").notNull().default(60),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  therapist: text("therapist"),
  isBar: boolean("is_bar").notNull().default(false),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaBookingsTable = pgTable("spa_bookings", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => spaServicesTable.id),
  serviceName: text("service_name").notNull(),
  guestName: text("guest_name").notNull(),
  guestPhone: text("guest_phone"),
  guestEmail: text("guest_email"),
  therapist: text("therapist"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  duration: integer("duration").notNull().default(60),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("booked"), // "booked" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show"
  notes: text("notes"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  bookingType: text("booking_type").notNull().default("single"), // single | couple | membership | wellness
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpaService = typeof spaServicesTable.$inferSelect;
export type SpaBooking = typeof spaBookingsTable.$inferSelect;
