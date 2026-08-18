import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  customerName: text("customer_name"),
  rating: integer("rating").notNull(),
  foodRating: integer("food_rating"),
  serviceRating: integer("service_rating"),
  ambienceRating: integer("ambience_rating"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
