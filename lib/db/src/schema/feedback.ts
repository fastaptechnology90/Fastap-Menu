import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
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

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;
