import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const waiterCallsTable = pgTable("waiter_calls", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  tableId: integer("table_id"),
  tableName: text("table_name"),
  type: text("type").notNull().default("waiter"),
  message: text("message"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWaiterCallSchema = createInsertSchema(waiterCallsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWaiterCall = z.infer<typeof insertWaiterCallSchema>;
export type WaiterCall = typeof waiterCallsTable.$inferSelect;
