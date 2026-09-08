import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { appReleasesTable } from "./app_releases";

/**
 * One row each time a staff app is downloaded.
 *
 * The release table carried a single `downloads` counter, so the platform owner could see
 * that an app had been fetched forty times and nothing else — not which venue, not which
 * staff member, not which version anyone was actually running. When an app misbehaves the
 * first question is "who has which build", and it could not be answered.
 *
 * The download link is deliberately open — a staff member's phone is not signed in when
 * they scan the QR — so the restaurant is identified by the slug the link carries, and the
 * staff member only when a per-person link was used.
 */
export const appDownloadsTable = pgTable("app_downloads", {
  id: serial("id").primaryKey(),

  releaseId: integer("release_id").references(() => appReleasesTable.id, { onDelete: "set null" }),
  appKey: text("app_key").notNull(),
  version: text("version"),

  /** Null when the link carried no venue — a direct hit on the public URL. */
  restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "cascade" }),

  /** Set only when the download came from a link minted for one person. */
  staffId: integer("staff_id"),
  staffName: text("staff_name"),

  /** Enough to tell one handset from another without storing anything identifying. */
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),

  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("app_downloads_restaurant_idx").on(table.restaurantId, table.downloadedAt),
  index("app_downloads_release_idx").on(table.releaseId),
]);

export type AppDownload = typeof appDownloadsTable.$inferSelect;
