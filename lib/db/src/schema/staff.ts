import { pgTable, text, serial, timestamp, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("waiter"),
  phone: text("phone"),
  pinHash: text("pin_hash"),
  salary: numeric("salary", { precision: 10, scale: 2 }),
  shift: text("shift").default("morning"),
  weeklySchedule: jsonb("weekly_schedule").default({}),
  status: text("status").notNull().default("active"),
  tablesAssigned: jsonb("tables_assigned").default([]),
  joinDate: timestamp("join_date", { withTimezone: true }),
  performanceScore: integer("performance_score").default(90),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
