import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  gstNumber: text("gst_number"),
  category: text("category").notNull().default("general"),
  rating: integer("rating").notNull().default(5),
  paymentTerms: text("payment_terms").notNull().default("immediate"),
  creditLimit: numeric("credit_limit", { precision: 10, scale: 2 }).notNull().default("0"),
  outstandingBalance: numeric("outstanding_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  supplierName: text("supplier_name").notNull(),
  poNumber: text("po_number").notNull(),
  status: text("status").notNull().default("draft"), // draft | sent | received | partial | cancelled
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  expectedDelivery: timestamp("expected_delivery", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  notes: text("notes"),
  invoiceUrl: text("invoice_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Supplier = typeof suppliersTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
