import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const restaurantsTable = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  currency: text("currency").notNull().default("INR"),
  primaryColor: text("primary_color").notNull().default("#f97316"),
  businessType: text("business_type"),
  timezone: text("timezone").notNull().default("UTC"),
  isActive: boolean("is_active").notNull().default(true),
  plan: text("plan").notNull().default("free"),
  gstNumber: text("gst_number"),
  fssaiNumber: text("fssai_number"),
  openTime: text("open_time").default("11:00"),
  closeTime: text("close_time").default("23:00"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurantsTable.$inferSelect;
