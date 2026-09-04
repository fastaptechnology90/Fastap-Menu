import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex, index, customType } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

/**
 * Raw binary column. The APK bytes are stored in Postgres because Railway's
 * container filesystem is wiped on every deploy, and the project has no object
 * storage — an uploaded file kept on disk would disappear the next time the
 * service restarts.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** The three staff apps a restaurant can be given. */
export const APP_KEYS = ["kitchen", "waiter", "housekeeping"] as const;
export type AppKey = (typeof APP_KEYS)[number];

/**
 * One row per uploaded build of a staff app. Super admin uploads a new version,
 * publishes it, and every restaurant's "Staff Apps" page picks it up immediately.
 */
export const appReleasesTable = pgTable("app_releases", {
  id: serial("id").primaryKey(),
  appKey: text("app_key").notNull(), // "kitchen" | "waiter" | "housekeeping"
  version: text("version").notNull(), // human version, e.g. "1.4.0"
  changelog: text("changelog"),
  fileName: text("file_name"),
  fileSize: integer("file_size").notNull().default(0),
  contentType: text("content_type").notNull().default("application/vnd.android.package-archive"),
  // "db" = bytes live in app_release_chunks; "link" = hosted elsewhere, downloadUrl is used.
  storage: text("storage").notNull().default("db"),
  downloadUrl: text("download_url"),
  // "draft" while chunks are still uploading, "published" once live, "archived" when superseded.
  status: text("status").notNull().default("draft"),
  uploadedBytes: integer("uploaded_bytes").notNull().default(0),
  downloads: integer("downloads").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: text("published_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index("app_releases_app_key_idx").on(table.appKey, table.status),
]);

/**
 * The upload arrives in pieces so an 80 MB APK never has to sit in memory whole,
 * either in the browser or on the server.
 */
export const appReleaseChunksTable = pgTable("app_release_chunks", {
  id: serial("id").primaryKey(),
  releaseId: integer("release_id").notNull().references(() => appReleasesTable.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  data: bytea("data").notNull(),
}, table => [
  uniqueIndex("app_release_chunks_release_idx").on(table.releaseId, table.idx),
]);

/**
 * Per-restaurant show/hide. A missing row means visible — a new restaurant sees
 * every app by default, and super admin only has to act when hiding one.
 */
export const appReleaseVisibilityTable = pgTable("app_release_visibility", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  appKey: text("app_key").notNull(),
  visible: boolean("visible").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  uniqueIndex("app_release_visibility_unique").on(table.restaurantId, table.appKey),
]);

export type AppRelease = typeof appReleasesTable.$inferSelect;
export type AppReleaseVisibility = typeof appReleaseVisibilityTable.$inferSelect;
