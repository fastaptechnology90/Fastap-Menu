import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("license"), // "license" | "compliance" | "agreement" | "financial" | "other"
  description: text("description"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  status: text("status").notNull().default("active"), // "active" | "expired" | "pending_renewal"
  uploadedBy: text("uploaded_by"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Document = typeof documentsTable.$inferSelect;
