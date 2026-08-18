import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("restaurant_owner"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  // Single-use token mailed to the address at sign-up. Cleared once the link is
  // opened, so a used link cannot verify a second time.
  emailVerificationToken: text("email_verification_token"),
  emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
  // Open registration (POST /auth/register) created a live restaurant_owner on the
  // spot, so anyone could mint an owner account. New self-service registrations now
  // land here as "pending" and a super admin must approve before sign-in works.
  // The default is "approved" on purpose: every account that already exists, and
  // every account an admin creates deliberately, stays usable — only the public
  // registration route sets "pending". Values: pending | approved | rejected.
  approvalStatus: text("approval_status").notNull().default("approved"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
