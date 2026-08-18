import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("raw_material"),
  unit: text("unit").notNull().default("kg"),
  currentStock: numeric("current_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  maxStock: numeric("max_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull().default("0"),
  supplier: text("supplier"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  batchNumber: text("batch_number"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "in" | "out" | "waste" | "adjustment"
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  reason: text("reason"),
  reference: text("reference"),
  performedBy: text("performed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
