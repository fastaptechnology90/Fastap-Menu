import { pgTable, text, serial, timestamp, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";
import { categoriesTable } from "./categories";

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountedPrice: numeric("discounted_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  preview360Url: text("preview_360_url"),
  ingredients: text("ingredients"),
  allergens: text("allergens"),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  prepTime: integer("prep_time"),
  prepMethod: text("prep_method"),
  chefRecommended: boolean("chef_recommended").notNull().default(false),
  customizationOptions: jsonb("customization_options").notNull().default({}),
  spiceLevel: integer("spice_level").notNull().default(0),
  dietaryTags: text("dietary_tags").array().notNull().default([]),
  isAvailable: boolean("is_available").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  orderCount: integer("order_count").notNull().default(0),
  variants: jsonb("variants").notNull().default([]),
  addons: jsonb("addons").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, orderCount: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;
