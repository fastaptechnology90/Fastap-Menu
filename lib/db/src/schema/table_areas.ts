import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const tableAreasTable = pgTable("table_areas", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  areaType: text("area_type").notNull().default("indoor"),
  description: text("description"),
  colorCode: text("color_code"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  layoutConfig: jsonb("layout_config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TableArea = typeof tableAreasTable.$inferSelect;
