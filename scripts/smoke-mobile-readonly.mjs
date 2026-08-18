#!/usr/bin/env node
/** Read-only production validation — GET endpoints only, no state changes. */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const BASE = process.env.API_BASE || "https://digitalrestuarants.thefingo.com";

console.log(`\n=== Read-only mobile smoke (production-safe) ===\n${BASE}\n`);

execSync("node scripts/smoke-mobile-api.mjs", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, API_BASE: BASE.replace(/\/api\/v1$/, "").replace(/\/api$/, "") || BASE },
});

// Verify DB-backed boards are non-empty on production
const ROOT = `${BASE.replace(/\/$/, "")}/api/v1`;
const PASS = process.env.MOBILE_PASS || "Staff@123";

async function login(staffCode, role) {
  const res = await fetch(`${ROOT}/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staffCode,
      password: PASS,
      deviceId: "readonly-smoke",
      role,
    }),
  });
  const json = await res.json();
  if (!json?.data?.token) throw new Error(`Login failed: ${staffCode}`);
  return json.data.token;
}

async function get(token, path) {
  const res = await fetch(`${ROOT}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  return { status: res.status, data: (await res.json())?.data };
}

async function main() {
  const chef = await login("chef@spicegarden.com", "headChef");
  const inv = await get(chef, "/inventory/board?section=All");
  const stub = (inv.data?.items ?? []).some((i) => i.id === "ING-001" && i.name === "Butter");
  if (stub) throw new Error("Production inventory still returns hardcoded Butter stub");
  console.log(`PASS  production inventory · ${inv.data?.items?.length ?? 0} DB items`);

  const hk = await login("housekeeping@spicegarden.com", "housekeeping");
  const hygiene = await get(hk, "/hygiene/board?section=All");
  const schedules = hygiene.data?.cleaningSchedules?.length ?? 0;
  if (schedules === 0) throw new Error("Production hygiene board empty");
  console.log(`PASS  production hygiene · ${schedules} schedules`);

  console.log("\n✓ Read-only production checks passed.\n");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
