import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { branchesTable } from "./branches";

export const tablesMapTable = pgTable("tables_map", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  zone: text("zone"),
  capacity: integer("capacity").notNull().default(4),
  qrCodeUrl: text("qr_code_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TableMap = typeof tablesMapTable.$inferSelect;
