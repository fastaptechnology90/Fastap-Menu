import { pgTable, text, serial, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  servings: integer("servings").notNull().default(1),
  preparationTime: integer("preparation_time").notNull().default(0),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }).notNull().default("0"),
  instructions: text("instructions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recipeIngredientsTable = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
  restaurantId: integer("restaurant_id").notNull(),
  ingredientName: text("ingredient_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  inventoryItemId: integer("inventory_item_id"),
});

export type Recipe = typeof recipesTable.$inferSelect;
export type RecipeIngredient = typeof recipeIngredientsTable.$inferSelect;
