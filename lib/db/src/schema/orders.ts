import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  tableId: integer("table_id"),
  tableName: text("table_name"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  type: text("type").notNull().default("dine_in"),
  status: text("status").notNull().default("pending"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  deliveryAddress: text("delivery_address"),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderSource: text("order_source").notNull().default("pos"),
  waiterId: integer("waiter_id"),
  waiterName: text("waiter_name"),
  guestCount: integer("guest_count").notNull().default(1),
  tipAmount: numeric("tip_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
  serviceCharge: numeric("service_charge", { precision: 10, scale: 2 }).default("0"),
  branchId: integer("branch_id"),
  cancelledReason: text("cancelled_reason"),
  nfcTagId: text("nfc_tag_id"),
  qrCodeId: integer("qr_code_id"),
  invoiceNumber: text("invoice_number"),
  items: jsonb("items").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
