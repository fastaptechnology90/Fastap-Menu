import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const menuViewsTable = pgTable("menu_views", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("qr"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
});
