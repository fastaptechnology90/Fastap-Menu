import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
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
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
