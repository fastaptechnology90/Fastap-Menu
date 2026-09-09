import "./load-env.js";
import { eq } from "drizzle-orm";
import { db, pool, restaurantsTable } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { runSeed } from "./seed.js";
import { ensurePlatformDefaults } from "./lib/platform-admin.js";
import { ensureDemoStaffAccounts } from "./lib/demo-staff.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureDemoData() {
  if (process.env.AUTO_SEED !== "true") return;
  try {
    const [existing] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, "spice-garden"));
    if (!existing) {
      logger.info("Demo restaurant missing — seeding database…");
      await runSeed();
      logger.info("Database seed complete");
      return;
    }
    const staff = await ensureDemoStaffAccounts();
    if (staff && (staff.created > 0 || staff.updated > 0)) {
      logger.info(staff, "Demo staff accounts synced for restaurant login");
    }
  } catch (err) {
    logger.warn({ err }, "Auto-seed skipped (is PostgreSQL running?)");
  }
}

// Idempotent, additive schema guards. Runs on every boot so newly-added columns work
// on any environment (Railway / VPS / local) even when `db:push` wasn't run at deploy.
// Only ADD COLUMN IF NOT EXISTS — never drops or alters existing data.
async function ensureSchemaColumns() {
  const guards = [
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_number text`,
    `ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_schedule jsonb DEFAULT '{}'::jsonb`,
    // Staff-app distribution: super admin uploads an APK here, every restaurant
    // panel offers it for install. Created on boot so a deploy needs no db:push.
    `CREATE TABLE IF NOT EXISTS app_releases (
      id serial PRIMARY KEY,
      app_key text NOT NULL,
      version text NOT NULL,
      changelog text,
      file_name text,
      file_size integer NOT NULL DEFAULT 0,
      content_type text NOT NULL DEFAULT 'application/vnd.android.package-archive',
      storage text NOT NULL DEFAULT 'db',
      download_url text,
      status text NOT NULL DEFAULT 'draft',
      uploaded_bytes integer NOT NULL DEFAULT 0,
      downloads integer NOT NULL DEFAULT 0,
      published_at timestamptz,
      published_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS app_releases_app_key_idx ON app_releases (app_key, status)`,
    `CREATE TABLE IF NOT EXISTS app_release_chunks (
      id serial PRIMARY KEY,
      release_id integer NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
      idx integer NOT NULL,
      data bytea NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS app_release_chunks_release_idx ON app_release_chunks (release_id, idx)`,
    `CREATE TABLE IF NOT EXISTS app_release_visibility (
      id serial PRIMARY KEY,
      restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      app_key text NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS app_release_visibility_unique ON app_release_visibility (restaurant_id, app_key)`,

    // Everything below was created by hand against a local database and existed nowhere
    // else, so a deploy would have shipped code querying tables the live database does
    // not have. Same rule as above: additive only, safe to run on every boot.

    // One row per shift a staff member works — payroll and the day-end report read this.
    `CREATE TABLE IF NOT EXISTS staff_attendance (
      id serial PRIMARY KEY,
      restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      staff_id integer NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      staff_name text NOT NULL,
      staff_role text NOT NULL,
      clocked_in_at timestamptz NOT NULL DEFAULT now(),
      clocked_out_at timestamptz,
      minutes_worked integer,
      break_minutes integer NOT NULL DEFAULT 0,
      sales_during_shift numeric(10,2) NOT NULL DEFAULT 0,
      clock_in_method text NOT NULL DEFAULT 'panel',
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS staff_attendance_open_idx ON staff_attendance (restaurant_id, clocked_out_at)`,
    `CREATE INDEX IF NOT EXISTS staff_attendance_staff_idx ON staff_attendance (staff_id, clocked_in_at)`,

    // Which venue is running which build of a staff app.
    `CREATE TABLE IF NOT EXISTS app_downloads (
      id serial PRIMARY KEY,
      release_id integer REFERENCES app_releases(id) ON DELETE SET NULL,
      app_key text NOT NULL,
      version text,
      restaurant_id integer REFERENCES restaurants(id) ON DELETE CASCADE,
      staff_id integer,
      staff_name text,
      user_agent text,
      ip_address text,
      downloaded_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS app_downloads_restaurant_idx ON app_downloads (restaurant_id, downloaded_at)`,
    `CREATE INDEX IF NOT EXISTS app_downloads_release_idx ON app_downloads (release_id)`,

    // The Z reading that actually closes a business day, so it cannot be taken twice.
    `CREATE TABLE IF NOT EXISTS day_closures (
      id serial PRIMARY KEY,
      restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      business_date text NOT NULL,
      z_number integer NOT NULL,
      report jsonb NOT NULL DEFAULT '{}'::jsonb,
      closed_at timestamptz NOT NULL DEFAULT now(),
      closed_by text
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS day_closures_unique ON day_closures (restaurant_id, business_date)`,

    // A tax invoice number has to be consecutive per venue per financial year.
    `CREATE TABLE IF NOT EXISTS invoice_series (
      restaurant_id integer NOT NULL,
      financial_year text NOT NULL,
      last_number integer NOT NULL DEFAULT 0,
      PRIMARY KEY (restaurant_id, financial_year)
    )`,

    // Staff-app sessions were in memory, so a restart signed every tablet out at once.
    `CREATE TABLE IF NOT EXISTS mobile_sessions (
      token text PRIMARY KEY,
      staff_id integer NOT NULL,
      restaurant_id integer NOT NULL,
      expires_at timestamptz NOT NULL,
      session jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS mobile_sessions_expiry_idx ON mobile_sessions (expires_at)`,

    // Alcohol is taxed outside GST, so a dish has to say which regime it falls under.
    `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tax_category text`,
  ];
  for (const sql of guards) {
    try {
      await pool.query(sql);
    } catch (err) {
      logger.warn({ err, sql }, "ensureSchemaColumns guard skipped");
    }
  }
}

async function start() {
  try {
    await ensureSchemaColumns();
  } catch (err) {
    logger.warn({ err }, "Schema column ensure skipped");
  }
  try {
    await ensurePlatformDefaults();
  } catch (err) {
    logger.warn({ err }, "Platform defaults init skipped");
  }
  await ensureDemoData();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
