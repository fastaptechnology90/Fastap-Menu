import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  guestCount: integer("guest_count").notNull().default(2),
  tableId: integer("table_id"),
  zone: text("zone"),
  reservationType: text("reservation_type").notNull().default("table"),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).default("0"),
  depositStatus: text("deposit_status").notNull().default("none"), // none | pending | paid | refunded
  bookingToken: text("booking_token"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  specialRequest: text("special_request"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReservationSchema = createInsertSchema(reservationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
