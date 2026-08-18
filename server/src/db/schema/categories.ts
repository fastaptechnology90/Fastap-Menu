import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  availableFrom: text("available_from"),
  availableTo: text("available_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Category = typeof categoriesTable.$inferSelect;
