import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const qrCodesTable = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  tableId: integer("table_id"),
  label: text("label").notNull(),
  type: text("type").notNull().default("table"),
  url: text("url").notNull(),
  scans: integer("scans").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type QrCode = typeof qrCodesTable.$inferSelect;
