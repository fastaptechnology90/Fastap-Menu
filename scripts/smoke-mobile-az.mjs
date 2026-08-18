#!/usr/bin/env node
/** A–Z smoke test for Flutter kitchen app API (/api/v1) */
const BASE = process.env.API_BASE || "https://digitalrestuarants.thefingo.com";
const ROOT = `${BASE}/api/v1`;

const GET_PATHS = [
  // Auth (after login)
  "/auth/session",
  "/auth/permissions",
  "/auth/shift/current",
  // Core kitchen
  "/dashboard?section=All",
  "/dashboard/widgets?section=All",
  "/dashboard/metrics?section=All",
  "/dashboard/orders?section=All",
  "/kds?section=All&view=queue&filter=all",
  "/sections/overview?section=All",
  "/sections/overview?section=All&includeRouting=true",
  "/orders/processing?section=All",
  // Enterprise modules 6–49
  "/firing/sessions?section=All",
  "/prep/board?section=All",
  "/modifiers/board?section=All",
  "/safety/board?section=All",
  "/chef-tasks/board?section=All",
  "/ai/assistant?section=All",
  "/orders/priority?section=All",
  "/kitchen/communication?section=All",
  "/inventory/board?section=All",
  "/recipes/costing?section=All",
  "/prep/stations?section=All",
  "/batch/cooking?section=All",
  "/delays/board?section=All",
  "/qc/board?section=All",
  "/returns/board?section=All",
  "/expeditor/board?section=All",
  "/packing/board?section=All",
  "/aggregator/board?section=All",
  "/bar/board?section=All",
  "/bakery/board?section=All",
  "/cloud-kitchen/board?section=All",
  "/banquet/board?section=All",
  "/room-service/board?section=All",
  "/hygiene/board?section=All",
  "/equipment/board?section=All",
  "/energy/board?section=All",
  "/iot/board?section=All",
  "/staff-performance/board?section=All",
  "/staff-shift/board?section=All",
  "/staff-wellness/board?section=All",
  "/live-alerts/board?section=All",
  "/panic-emergency/board?section=All",
  "/offline-failover/board?section=All",
  "/analytics-reporting/board?section=All",
  "/kitchen-heatmap/board?section=All",
  "/hardware-integration/board?section=All",
  "/smartwatch-support/board?section=All",
  "/multi-branch/board?section=All",
  "/audit-compliance/board?section=All",
  "/backup-recovery/board?section=All",
  "/sandbox-training/board?section=All",
  "/hidden-enterprise/board?section=All",
  "/future-ai-expansion/board?section=All",
  "/waiter-auto-assignment/board?section=All",
];

const POST_PATHS = [
  ["/auth/logout", {}],
  ["/auth/activity", { action: "screen_view", deviceId: "smoke-1" }],
  ["/auth/device/bind", { deviceId: "smoke-device-az" }],
  ["/kds/reorder", { orderIds: [] }],
  ["/sections/optimize", {}],
  ["/orders/processing/optimize", {}],
  ["/live-alerts/ALERT-ORD-1/action", { action: "acknowledge_alert" }],
  ["/ai/assistant/apply", { suggestionId: "SUG-1" }],
  ["/inventory/sync", {}],
  ["/waiter-auto-assignment/auto-allocate", {}],
];

const DATA_SHAPE = {
  "/dashboard": ["section", "lastSyncedAt", "sections", "widgets", "metrics", "sectionWorkload", "rushAlerts", "orders"],
  "/kds": ["section", "view", "filter", "lastSyncedAt", "orders", "stats"],
  "/sections/overview?section=All&includeRouting=true": ["overview", "routing"],
  "/orders/processing": ["section", "lastSyncedAt", "orders", "stats", "smartProcessing", "batchCooking", "cookingSequence", "sections"],
  "/firing/sessions": ["sessions", "stats", "smartFiring", "coordinationBoard"],
  "/prep/board": ["tasks", "stats"],
  "/modifiers/board": ["orders", "stats"],
  "/safety/board": ["cases", "stats"],
  "/inventory/board": ["items", "batches", "stats", "inventoryFeatures"],
  "/live-alerts/board": ["alerts", "stats", "alertFeatures"],
  "/waiter-auto-assignment/board": ["tasks", "notifications", "workloadBoard", "stats", "featureFlags"],
};

async function req(method, path, body, token, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ROOT}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 200) }; }
      return { status: res.status, json };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

function missingKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return keys;
  return keys.filter(k => !(k in obj));
}

async function main() {
  console.log(`Mobile A–Z smoke: ${ROOT}\n`);
  const failures = [];

  const login = await req("POST", "/auth/password", {
    staffCode: process.env.MOBILE_STAFF || "chef@spicegarden.com",
    password: process.env.MOBILE_PASS || "Staff@123",
    deviceId: "smoke-az-device",
    role: "headChef",
  });
  if (login.status !== 200 || !login.json?.data?.token) {
    console.error("LOGIN FAILED", login.status, login.json);
    process.exit(1);
  }
  const token = login.json.data.token;
  console.log("✓ POST /auth/password\n");

  for (const path of GET_PATHS) {
    const r = await req("GET", path, null, token);
    const label = path.split("?")[0];
    const ok = r.status === 200;
    const data = r.json?.data ?? r.json;
    const shapeKeys = DATA_SHAPE[path] ?? DATA_SHAPE[label];
    const missing = shapeKeys ? missingKeys(data, shapeKeys) : [];
    if (ok && missing.length === 0) {
      console.log(`✓ GET ${label}`);
    } else if (ok && missing.length) {
      console.log(`✗ GET ${label} → missing keys: ${missing.join(", ")}`);
      failures.push({ method: "GET", path: label, missing });
    } else {
      console.log(`✗ GET ${label} → ${r.status}`, JSON.stringify(r.json).slice(0, 120));
      failures.push({ method: "GET", path: label, status: r.status });
    }
  }

  // Re-login after logout test would break token — run non-logout POSTs first
  for (const [path, body] of POST_PATHS.filter(([p]) => p !== "/auth/logout")) {
    const r = await req("POST", path, body, token);
    const ok = r.status >= 200 && r.status < 300;
    if (ok) console.log(`✓ POST ${path}`);
    else {
      console.log(`✗ POST ${path} → ${r.status}`);
      failures.push({ method: "POST", path, status: r.status });
    }
  }

  const otpReq = await req("POST", "/auth/otp/request", { phone: "9876543214" });
  if (otpReq.status === 200 && otpReq.json?.success) {
    console.log("✓ POST /auth/otp/request");
    const otpVerify = await req("POST", "/auth/otp/verify", {
      phone: "9876543214",
      otp: "123456",
      deviceId: "smoke-az-device",
      role: "headChef",
    });
    if (otpVerify.status === 200 && otpVerify.json?.data?.token) {
      console.log("✓ POST /auth/otp/verify");
    } else {
      console.log(`✗ POST /auth/otp/verify → ${otpVerify.status}`);
      failures.push({ method: "POST", path: "/auth/otp/verify", status: otpVerify.status });
    }
  } else {
    console.log(`✗ POST /auth/otp/request → ${otpReq.status}`, JSON.stringify(otpReq.json).slice(0, 120));
    failures.push({ method: "POST", path: "/auth/otp/request", status: otpReq.status });
  }

  console.log(`\n--- Summary: ${GET_PATHS.length + POST_PATHS.length + 2} checks, ${failures.length} failed ---`);
  if (failures.length) {
    console.log(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log("All mobile kitchen A–Z API checks passed.");
}

main().catch(e => { console.error(e); process.exit(1); });
