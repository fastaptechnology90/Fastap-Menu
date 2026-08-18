#!/usr/bin/env node
/**
 * A–Z API smoke test: guest public APIs, restaurant panel, super admin, all staff roles.
 * Usage: API_BASE=https://digitalrestuarants.thefingo.com/api node scripts/smoke-api-az.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:8080/api";
const SLUG = "spice-garden";
const today = new Date().toISOString().split("T")[0];

let cookie = "";
const results = [];

async function req(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const part = c.split(";")[0];
    if (part) cookie = cookie ? `${cookie}; ${part}` : part;
  }
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else if (ct.includes("pdf") || ct.includes("octet-stream")) {
    const buf = await res.arrayBuffer();
    data = { bytes: buf.byteLength };
  } else {
    data = (await res.text()).slice(0, 120);
  }
  return { status: res.status, data };
}

function okStatus(status, expect = 200) {
  return status === expect || status === 201;
}

function record(section, name, ok, detail = "") {
  results.push({ section, name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  [${section}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(section, name, path, expect = 200) {
  const r = await req("GET", path);
  record(section, name, okStatus(r.status, expect), okStatus(r.status, expect) ? "" : `status ${r.status}`);
  return r;
}

async function post(section, name, path, body, expect = 200) {
  const r = await req("POST", path, body);
  record(section, name, okStatus(r.status, expect) || r.status === expect, okStatus(r.status, expect) ? "" : `status ${r.status}`);
  return r;
}

const STAFF_ROLES = [
  "owner", "manager", "cashier", "waiter", "chef", "kitchen", "reception",
  "finance", "housekeeping", "bar", "spa", "hr", "franchise",
];

async function main() {
  console.log(`\n=== FastMenu A–Z API smoke test ===\n${BASE}\n`);

  // ── A: Auth & health ──
  await get("A-Health", "health", "/health");
  let restaurantId = 6;
  const venue = await get("A-Health", "public venue", `/public/venue/${SLUG}?table=T-12`);
  if (venue.data?.restaurant?.id) restaurantId = venue.data.restaurant.id;

  // ── B–G: Guest / user public APIs ──
  const guestGets = [
    ["public menu", `/public/menu/${SLUG}`],
    ["oauth config", "/public/auth/oauth-config"],
    ["guest types", "/public/auth/guest-types"],
    ["ai-future catalog", "/public/ai-future/catalog"],
    ["social catalog", "/public/social/catalog"],
    ["social ratings", `/public/social/ratings/${SLUG}`],
    ["payments catalog", "/public/payments/catalog"],
    ["queue stats", `/public/queue/stats/${restaurantId}?partySize=2`],
    ["queue waitlist", `/public/queue/waitlist/${restaurantId}`],
    ["reservation types", "/public/reservations/types"],
    ["reservation slots", `/public/reservations/slots?restaurantId=${restaurantId}&date=${today}&reservationType=table`],
    ["bar catalog", `/public/bar/catalog/${restaurantId}`],
    ["events catalog", `/public/events/catalog/${restaurantId}`],
    ["spa catalog", `/public/spa/catalog/${restaurantId}`],
    ["spa services", `/public/spa/services/${restaurantId}`],
    ["wallet catalog", "/public/wallet/catalog"],
    ["loyalty catalog", "/public/loyalty/catalog"],
    ["ai personalized menu", `/public/ai/personalized-menu/${restaurantId}`],
    ["support config", `/public/support/config/${restaurantId}`],
    ["offline status", "/public/offline/status"],
    ["pwa catalog", "/public/pwa/catalog"],
    ["locale catalog", "/public/locale/catalog"],
    ["kiosk catalog", "/public/kiosk/catalog"],
    ["digital experience", "/public/digital-experience/catalog"],
    ["seating catalog", "/public/seating/catalog"],
    ["hotel room", `/public/hotel/room/${restaurantId}/501`],
    ["dining running bill", `/public/dining/running-bill?restaurantId=${restaurantId}&tableName=T-12`],
  ];
  for (const [name, path] of guestGets) await get("B-Guest", name, path);

  cookie = "";
  await post("B-Guest", "otp send", "/public/auth/otp/send", { phone: "9876543210" });
  const otpVerify = await post("B-Guest", "otp verify", "/public/auth/otp/verify", {
    phone: "9876543210", otp: "123456", name: "AZ Test", restaurantId,
  });
  await get("B-Guest", "auth me", "/public/auth/me");
  await get("B-Guest", "my orders", "/public/me/orders");
  await get("B-Guest", "my favorites", "/public/me/favorites");

  await post("B-Guest", "coupon validate", "/public/coupons/validate", {
    restaurantId, code: "HAPPY20", subtotal: 500,
  });
  const menu = await req("GET", `/public/menu/${SLUG}`);
  const item = menu.data?.items?.[0] || menu.data?.categories?.[0]?.items?.[0];
  if (item?.id) {
    const order = await post("B-Guest", "place order", "/public/orders", {
      restaurantId, tableName: "T-12", customerName: "AZ Test", customerPhone: "9876543210",
      items: [{ menuItemId: item.id, quantity: 1 }],
    }, 201);
    const oid = order.data?.id;
    if (oid) {
      await get("B-Guest", "order status", `/public/orders/${oid}/status`);
      try {
        const live = await req("GET", `/public/orders/${oid}/live`);
        record("B-Guest", "order live", live.status === 200, live.status === 200 ? "" : `status ${live.status}`);
      } catch {
        record("B-Guest", "order live", true, "skipped (SSE timeout ok)");
      }
    }
  }

  // ── C: All 13 staff role logins ──
  for (const role of STAFF_ROLES) {
    cookie = "";
    const login = await req("POST", "/restaurant-auth/login", {
      email: `${role}@spicegarden.com`,
      password: process.env.DEMO_PASSWORD || "Staff@123",
    });
    record("C-Roles", `login ${role}`, login.status === 200 && login.data?.staff?.role === role,
      login.data?.error || login.data?.staff?.role);
  }

  // ── D: Restaurant panel APIs (owner session) ──
  cookie = "";
  const ownerLogin = await req("POST", "/restaurant-auth/login", {
    email: "owner@spicegarden.com",
    password: process.env.DEMO_PASSWORD || "Staff@123",
  });
  const rid = ownerLogin.data?.restaurant?.id || restaurantId;
  record("D-Restaurant", "owner login", ownerLogin.status === 200);

  const restaurantGets = [
    ["dashboard", `/restaurants/${rid}/dashboard`],
    ["orders", `/restaurants/${rid}/orders`],
    ["tables", `/restaurants/${rid}/tables`],
    ["categories", `/restaurants/${rid}/categories`],
    ["items", `/restaurants/${rid}/items`],
    ["staff", `/restaurants/${rid}/staff`],
    ["customers", `/restaurants/${rid}/customers`],
    ["reservations", `/restaurants/${rid}/reservations`],
    ["queue", `/restaurants/${rid}/queue`],
    ["inventory", `/restaurants/${rid}/inventory`],
    ["analytics summary", `/restaurants/${rid}/analytics/summary`],
    ["audit logs", `/restaurants/${rid}/audit-logs`],
    ["notifications", `/restaurants/${rid}/notifications-log`],
    ["documents", `/restaurants/${rid}/documents`],
    ["hardware", `/restaurants/${rid}/hardware`],
    ["loyalty", `/restaurants/${rid}/loyalty`],
    ["reviews", `/restaurants/${rid}/reviews`],
    ["signage", `/restaurants/${rid}/signage`],
    ["kiosk settings", `/restaurants/${rid}/kiosk/settings`],
    ["rbac", `/restaurants/${rid}/rbac`],
    ["bar inventory", `/restaurants/${rid}/bar/inventory`],
    ["bar recipes", `/restaurants/${rid}/bar/recipes`],
    ["platform offline", `/restaurants/${rid}/platform/offline`],
    ["platform aggregators", `/restaurants/${rid}/platform/aggregators`],
    ["platform sandbox", `/restaurants/${rid}/platform/sandbox`],
    ["platform accessibility", `/restaurants/${rid}/platform/accessibility`],
    ["platform api-keys", `/restaurants/${rid}/platform/api-keys`],
    ["waiter calls", `/restaurants/${rid}/waiter-calls`],
    ["promo codes", `/restaurants/${rid}/promo-codes`],
    ["gift cards", `/restaurants/${rid}/gift-cards`],
    ["suppliers", `/restaurants/${rid}/suppliers`],
    ["purchase orders", `/restaurants/${rid}/purchase-orders`],
    ["tasks", `/restaurants/${rid}/tasks`],
    ["sop", `/restaurants/${rid}/sop`],
    ["cash shifts", `/restaurants/${rid}/cash-shifts`],
    ["franchise", `/restaurants/${rid}/franchise`],
    ["stock transfers", `/restaurants/${rid}/stock-transfers`],
    ["branch analytics", `/restaurants/${rid}/branches/analytics`],
    ["marketing automation", `/restaurants/${rid}/marketing/automation`],
    ["monitoring logs", `/restaurants/${rid}/monitoring/logs`],
    ["monitoring history", `/restaurants/${rid}/monitoring/history`],
    ["training videos", `/restaurants/${rid}/training-videos`],
    ["checklists", `/restaurants/${rid}/checklists`],
    ["finance transactions", `/restaurants/${rid}/finance/transactions`],
    ["food costing recipes", `/restaurants/${rid}/recipes`],
    ["housekeeping tasks", `/restaurants/${rid}/housekeeping`],
    ["room service", `/restaurants/${rid}/room-service`],
    ["spa services", `/restaurants/${rid}/spa/services`],
    ["banquet events", `/restaurants/${rid}/events`],
    ["commissions", `/restaurants/${rid}/commissions`],
    ["campaigns", `/restaurants/${rid}/campaigns`],
    ["corporate accounts", `/restaurants/${rid}/corporate/accounts`],
    ["backup", `/restaurants/${rid}/backup`],
    ["ai insights", `/restaurants/${rid}/ai/insights`],
    ["restaurant auth security", "/restaurant-auth/security"],
    ["restaurant auth me", "/restaurant-auth/me"],
    ["subscription plans", "/restaurant-auth/subscription/plans"],
    ["subscription status", "/restaurant-auth/subscription"],
    ["hotel guest catalog", `/public/hotel/catalog/${rid}`],
  ];
  for (const [name, path] of restaurantGets) await get("D-Restaurant", name, path);

  // ── E: Super admin APIs ──
  cookie = "";
  const adminLogin = await post("E-Admin", "admin login", "/auth/login", {
    email: process.env.ADMIN_EMAIL || "superadmin@fastapmenu.com",
    password: process.env.ADMIN_PASSWORD || "Admin@123",
  });
  await get("E-Admin", "admin me", "/auth/me");

  const adminGets = [
    ["stats", "/superadmin/stats"],
    ["vendors", "/superadmin/vendors"],
    ["restaurants", "/superadmin/restaurants"],
    ["users", "/superadmin/users"],
    ["plans", "/superadmin/plans"],
    ["analytics summary", "/superadmin/analytics/summary"],
    ["analytics revenue", "/superadmin/analytics/revenue-series"],
    ["analytics extended", "/superadmin/analytics/extended"],
    ["audit logs", "/superadmin/audit-logs"],
    ["payments", "/superadmin/payments"],
    ["settlements", "/superadmin/settlements"],
    ["kyc", "/superadmin/kyc"],
    ["refunds", "/superadmin/refunds"],
    ["support", "/superadmin/support"],
    ["coupons", "/superadmin/coupons"],
    ["fraud", "/superadmin/fraud"],
    ["commissions", "/superadmin/commissions"],
    ["chargebacks", "/superadmin/chargebacks"],
    ["api keys", "/superadmin/api-keys"],
    ["settings", "/superadmin/settings"],
    ["taxes", "/superadmin/taxes"],
    ["tax reports", "/superadmin/taxes/reports"],
    ["subscriptions", "/superadmin/subscriptions"],
    ["invoices", "/superadmin/invoices"],
    ["escrow", "/superadmin/escrow"],
    ["notifications", "/superadmin/notifications"],
    ["communications", "/superadmin/communications"],
    ["security", "/superadmin/security"],
    ["reconciliation", "/superadmin/reconciliation"],
    ["penalties", "/superadmin/penalties"],
    ["tasks", "/superadmin/tasks"],
    ["vendor detail", `/superadmin/vendors/${rid}`],
    ["vendor staff", `/superadmin/vendors/${rid}/staff`],
    ["vendor branches", `/superadmin/vendors/${rid}/branches`],
    ["vendor documents", `/superadmin/vendors/${rid}/documents`],
  ];
  for (const [name, path] of adminGets) await get("E-Admin", name, path);

  // ── Summary ──
  const bySection = {};
  for (const r of results) {
    if (!bySection[r.section]) bySection[r.section] = { pass: 0, fail: 0 };
    if (r.ok) bySection[r.section].pass++;
    else bySection[r.section].fail++;
  }

  console.log("\n=== Summary by section ===");
  for (const [sec, c] of Object.entries(bySection)) {
    console.log(`  ${sec}: ${c.pass}/${c.pass + c.fail} passed`);
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\nTOTAL: ${passed}/${results.length} passed`);

  if (failed.length) {
    console.log("\nFailed endpoints:");
    for (const f of failed) console.log(`  [${f.section}] ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
    process.exit(1);
  }
  console.log("\nAll A–Z API checks passed.\n");
}

main().catch(e => { console.error(e); process.exit(1); });
