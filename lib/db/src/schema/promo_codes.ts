import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscount: numeric("max_discount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCode = typeof promoCodesTable.$inferSelect;
