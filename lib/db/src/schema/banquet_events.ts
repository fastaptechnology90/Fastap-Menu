import { pgTable, text, serial, timestamp, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const banquetEventsTable = pgTable("banquet_events", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("enquiry"),
  eventDate: timestamp("event_date", { withTimezone: true }),
  eventTime: text("event_time"),
  guestCount: integer("guest_count").notNull().default(0),
  venue: text("venue"),
  status: text("status").notNull().default("enquiry"),
  advancePaid: numeric("advance_paid", { precision: 10, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  menu: text("menu"),
  notes: text("notes"),
  catering: boolean("catering").default(true),
  decor: boolean("decor").default(false),
  staffAssigned: jsonb("staff_assigned").default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BanquetEvent = typeof banquetEventsTable.$inferSelect;
