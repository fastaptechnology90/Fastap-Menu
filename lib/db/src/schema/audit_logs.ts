import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  category: text("category").notNull().default("general"),
  severity: text("severity").notNull().default("info"), // "info" | "warning" | "critical"
  performedBy: text("performed_by").notNull(),
  role: text("role"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  details: jsonb("details").notNull().default({}),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
