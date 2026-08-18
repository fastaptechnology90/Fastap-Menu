import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";
import { branchesTable } from "./branches";

export const tablesMapTable = pgTable("tables_map", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  zone: text("zone"),
  tableType: text("table_type").notNull().default("4_seater"),
  tableCategory: text("table_category").notNull().default("restaurant"),
  capacity: integer("capacity").notNull().default(4),
  qrCodeUrl: text("qr_code_url"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("free"),
  isVip: boolean("is_vip").notNull().default(false),
  currentGuestCount: integer("current_guest_count").notNull().default(0),
  occupiedSince: timestamp("occupied_since", { withTimezone: true }),
  colorCode: text("color_code"),
  mergedInto: integer("merged_into"),
  currentWaiterName: text("current_waiter_name"),
  currentOrderId: integer("current_order_id"),
  currentCustomerName: text("current_customer_name"),
  areaId: integer("area_id"),
  positionX: integer("position_x"),
  positionY: integer("position_y"),
  reservedUntil: timestamp("reserved_until", { withTimezone: true }),
  reservationId: integer("reservation_id"),
  notes: text("notes"),
  lockedBy: text("locked_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTableSchema = createInsertSchema(tablesMapTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type TableMap = typeof tablesMapTable.$inferSelect;
