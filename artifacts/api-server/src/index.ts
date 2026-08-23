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
