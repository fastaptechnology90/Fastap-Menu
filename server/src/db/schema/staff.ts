import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("waiter"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Staff = typeof staffTable.$inferSelect;
