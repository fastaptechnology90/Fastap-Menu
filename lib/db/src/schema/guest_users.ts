import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guestUsersTable = pgTable("guest_users", {
  id: serial("id").primaryKey(),
  phone: text("phone").unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  avatar: text("avatar"),
  tier: text("tier").notNull().default("silver"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").default("Asia/Kolkata"),
  isGuest: boolean("is_guest").notNull().default(false),
  loginProvider: text("login_provider").notNull().default("otp"),
  deviceInfo: jsonb("device_info").default({}),
  walletBalance: text("wallet_balance").notNull().default("0"),
  cashbackBalance: text("cashback_balance").notNull().default("0"),
  walletBuckets: jsonb("wallet_buckets").notNull().default({
    main: "0",
    cashback: "0",
    refund: "0",
    reward: "0",
    gift: "0",
    membership: "0",
  }),
  loyaltyPoints: text("loyalty_points").notNull().default("0"),
  birthday: text("birthday"),
  anniversary: text("anniversary"),
  rewardsMeta: jsonb("rewards_meta").notNull().default({
    diningCredits: 0,
    birthdayClaimedYear: null,
    anniversaryClaimedYear: null,
  }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuestUserSchema = createInsertSchema(guestUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuestUser = z.infer<typeof insertGuestUserSchema>;
export type GuestUser = typeof guestUsersTable.$inferSelect;
