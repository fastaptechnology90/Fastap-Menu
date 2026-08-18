#!/usr/bin/env node
/**
 * Full-stack verification: 3 web panels + 3 Flutter mobile apps (kitchen, waiter, housekeeping).
 * Usage:
 *   API_BASE=https://digitalrestuarants.thefingo.com/api \
 *   MOBILE_BASE=https://digitalrestuarants.thefingo.com \
 *   WEB_BASE=https://digitalrestuarants.thefingo.com \
 *   node scripts/smoke-full-stack.mjs
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const API_BASE = process.env.API_BASE || "https://digitalrestuarants.thefingo.com/api";
const MOBILE_BASE = process.env.MOBILE_BASE || "https://digitalrestuarants.thefingo.com";
const WEB_BASE = process.env.WEB_BASE || "https://digitalrestuarants.thefingo.com";

const MOBILE_ROLES = [
  {
    app: "kitchenapp",
    label: "Kitchen",
    staffCode: process.env.MOBILE_STAFF_CHEF || "chef@spicegarden.com",
    role: "headChef",
    boards: [
      "/dashboard?section=All",
      "/kds?section=All",
      "/orders/processing",
      "/chef-tasks/board?section=All",
      "/inventory/board?section=All",
      "/prep/board?section=All",
      "/kitchen/communication?section=All",
      "/live-alerts/board?section=All",
      "/recipes/costing?section=All",
      "/multi-branch/board?section=All",
      "/audit-compliance/board?section=All",
    ],
  },
  {
    app: "waiterapp",
    label: "Waiter",
    staffCode: process.env.MOBILE_STAFF_WAITER || "waiter@spicegarden.com",
    role: "waiter",
    boards: [
      "/dashboard?section=All",
      "/waiter-auto-assignment/board?section=All",
      "/orders/priority?section=All",
      "/banquet/board?section=All",
      "/cloud-kitchen/board?section=All",
      "/live-alerts/board?section=All",
    ],
  },
  {
    app: "housekeepingapp",
    label: "Housekeeping",
    staffCode: process.env.MOBILE_STAFF_HK || "housekeeping@spicegarden.com",
    role: "housekeeping",
    boards: [
      "/dashboard?section=All",
      "/hygiene/board?section=All",
      "/room-service/board?section=All",
      "/orders/priority?section=All",
      "/live-alerts/board?section=All",
    ],
  },
];

const WEB_ROUTES = [
  ["/", "Guest home"],
  ["/user/menu?slug=spice-garden&table=T-12", "Guest menu"],
  ["/restaurant/login", "Restaurant login"],
  ["/restaurant/dashboard", "Restaurant dashboard"],
  ["/restaurant/housekeeping", "Restaurant housekeeping"],
  ["/restaurant/waiter", "Restaurant waiter"],
  ["/admin/", "Super admin"],
  ["/admin/login", "Super admin login"],
];

function run(name, cmd, env = {}) {
  console.log(`\n━━━ ${name} ━━━\n`);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

async function mobileRoleSmoke(spec) {
  const ROOT = `${MOBILE_BASE}/api/v1`;
  console.log(`\n── ${spec.label} app (${spec.app}) ──`);

  const loginRes = await fetch(`${ROOT}/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      staffCode: spec.staffCode,
      password: process.env.MOBILE_PASS || "Staff@123",
      deviceId: "full-stack-smoke",
      role: spec.role,
    }),
  });
  const login = await loginRes.json();
  if (loginRes.status !== 200 || !login?.data?.token) {
    throw new Error(`${spec.label} login failed: ${loginRes.status}`);
  }
  console.log(`PASS  ${spec.label} login`);

  const token = login.data.token;
  const perms = login.data.permissions ?? [];
  console.log(`      permissions: ${perms.length} granted`);

  for (const board of spec.boards) {
    const res = await fetch(`${ROOT}${board}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const label = board.split("?")[0];
    if (res.status !== 200) {
      const body = await res.text();
      throw new Error(`${spec.label} GET ${label} → ${res.status}: ${body.slice(0, 120)}`);
    }
    console.log(`PASS  ${spec.label} GET ${label}`);
  }
}

async function webRoutesSmoke() {
  console.log("\n── Web UI routes ──");
  for (const [route, label] of WEB_ROUTES) {
    const res = await fetch(`${WEB_BASE}${route}`);
    if (res.status !== 200) {
      throw new Error(`Web ${label} (${route}) → ${res.status}`);
    }
    console.log(`PASS  web ${label}`);
  }
}

async function main() {
  console.log(`\n=== FastMenu full-stack smoke ===`);
  console.log(`API:    ${API_BASE}`);
  console.log(`Mobile: ${MOBILE_BASE}/api/v1`);
  console.log(`Web:    ${WEB_BASE}\n`);

  run("Panels (guest + restaurant + super admin)", "node scripts/smoke-all-panels.mjs", {
    API_BASE,
    WEB_BASE,
  });

  run("Restaurant A–Z APIs (60+ endpoints)", "node scripts/smoke-api-az.mjs", { API_BASE });

  run("Kitchen mobile A–Z (48 enterprise modules)", "node scripts/smoke-mobile-az.mjs", {
    API_BASE: MOBILE_BASE,
  });

  for (const spec of MOBILE_ROLES) {
    await mobileRoleSmoke(spec);
  }

  await webRoutesSmoke();

  console.log("\n✓ All 3 Flutter apps, 3 web panels, and API integrations verified.\n");
}

main().catch((e) => {
  console.error("\n✗ Full-stack smoke failed:", e.message || e);
  process.exit(1);
});
