import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  triggerType: text("trigger_type").notNull().default("manual"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  targetSegment: text("target_segment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
