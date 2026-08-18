#!/usr/bin/env node
/**
 * Remove seeded demo restaurant, staff, test registrations, and demo guest accounts.
 *
 * Usage (production VPS):
 *   CONFIRM_CLEAN=1 DATABASE_URL=postgresql://... node scripts/clean-demo-data.mjs
 *
 * Dry run (lists what would be removed — read-only):
 *   node scripts/clean-demo-data.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

if (dryRun) {
  console.log("Dry run — demo markers that will be removed when CONFIRM_CLEAN=1:\n");
  console.log("  Restaurants: slug spice-garden, or staff @spicegarden.com");
  console.log("  Owners: demo@fastapmenu.com, *@fastap.test, pub-test-*");
  console.log("  Guests: phone 9876543210, rahul@example.com, *@example.com");
  console.log("  Kept: superadmin@fastapmenu.com, real restaurant registrations\n");
  console.log("Run: CONFIRM_CLEAN=1 node scripts/clean-demo-data.mjs");
  process.exit(0);
}

const env = { ...process.env };
if (!env.CONFIRM_CLEAN) {
  console.error("Set CONFIRM_CLEAN=1 to execute cleanup.");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["tsx", "artifacts/api-server/src/clean-demo-data.ts", "--confirm"],
  { cwd: root, env, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
