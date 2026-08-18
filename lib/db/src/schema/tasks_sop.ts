import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // "opening" | "closing" | "cleaning" | "service" | "general"
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  assignedTo: text("assigned_to"),
  assignedRole: text("assigned_role"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringSchedule: text("recurring_schedule"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sopItemsTable = pgTable("sop_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("service"),
  content: text("content").notNull(),
  steps: jsonb("steps").notNull().default([]),
  videoUrl: text("video_url"),
  assignedRoles: jsonb("assigned_roles").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasksTable.$inferSelect;
export type SopItem = typeof sopItemsTable.$inferSelect;
