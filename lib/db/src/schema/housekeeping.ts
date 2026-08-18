import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const housekeepingTasksTable = pgTable("housekeeping_tasks", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("cleaning"), // "cleaning" | "maintenance" | "inspection" | "linen"
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  roomNumber: text("room_number"),
  priority: text("priority").notNull().default("normal"), // "low" | "normal" | "high" | "urgent"
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "completed" | "skipped"
  assignedTo: text("assigned_to"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringInterval: text("recurring_interval"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceRequestsTable = pgTable("maintenance_requests", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"), // "open" | "in_progress" | "resolved" | "closed"
  reportedBy: text("reported_by"),
  assignedTo: text("assigned_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  estimatedCost: text("estimated_cost"),
  actualCost: text("actual_cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HousekeepingTask = typeof housekeepingTasksTable.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequestsTable.$inferSelect;
