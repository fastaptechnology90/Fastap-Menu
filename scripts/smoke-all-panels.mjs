#!/usr/bin/env node
/**
 * Integration smoke test: User web panel ↔ Restaurant panel ↔ Super Admin panel
 * Usage: API_BASE=https://digitalrestuarants.thefingo.com/api node scripts/smoke-all-panels.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:8080/api";
const WEB = process.env.WEB_BASE || "https://digitalrestuarants.thefingo.com";
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
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const part = c.split(";")[0];
    if (part) cookie = cookie ? `${cookie}; ${part}` : part;
  }
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = (await res.text()).slice(0, 200);
  }
  return { status: res.status, data };
}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\n=== FastMenu 3-panel integration test ===\nAPI: ${BASE}\nWeb: ${WEB}\n`);

  // ── Health ──
  const health = await req("GET", "/health");
  record("API health", health.status === 200);

  // ── USER PANEL (guest / public API) ──
  console.log("\n--- User web panel (guest API) ---");
  const venue = await req("GET", `/public/venue/${SLUG}?table=T-12`);
  const restaurantId = venue.data?.restaurant?.id;
  record("guest venue load", venue.status === 200 && !!restaurantId, venue.data?.restaurant?.name);

  record("guest menu", (await req("GET", `/public/menu/${SLUG}`)).status === 200);
  record("guest queue stats", (await req("GET", `/public/queue/stats/${restaurantId}?partySize=2`)).status === 200);
  record("guest reservation slots", (await req("GET", `/public/reservations/slots?restaurantId=${restaurantId}&date=${today}&reservationType=table`)).status === 200);
  record("guest spa services", (await req("GET", `/public/spa/services/${restaurantId}`)).status === 200);
  record("guest hotel room", (await req("GET", `/public/hotel/room/${restaurantId}/501`)).status === 200);

  cookie = "";
  const otpSend = await req("POST", "/public/auth/otp/send", { phone: "9876543210" });
  const otpCode = otpSend.data?.devOtp || "123456";
  const otpVerify = await req("POST", "/public/auth/otp/verify", {
    phone: "9876543210", otp: otpCode, name: "Integration Test", restaurantId,
  });
  record("guest OTP login", otpVerify.status === 200 && !!otpVerify.data?.user);
  record("guest auth me", (await req("GET", "/public/auth/me")).status === 200);
  record("guest my orders", (await req("GET", "/public/me/orders")).status === 200);

  const menu = await req("GET", `/public/menu/${SLUG}`);
  const item = menu.data?.items?.[0] || menu.data?.categories?.[0]?.items?.[0];
  if (item?.id) {
    const order = await req("POST", "/public/orders", {
      restaurantId,
      tableName: "T-12",
      customerName: "Integration Test",
      customerPhone: "9876543210",
      items: [{ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }],
    });
    record("guest place order", order.status === 201, order.data?.error || `order #${order.data?.id}`);
  } else {
    record("guest place order", false, "no menu item");
  }

  // ── RESTAURANT PANEL ──
  console.log("\n--- Restaurant panel (staff API) ---");
  cookie = "";
  const staffLogin = await req("POST", "/restaurant-auth/login", {
    email: "owner@spicegarden.com",
    password: process.env.DEMO_PASSWORD || "Staff@123",
  });
  record("restaurant owner login", staffLogin.status === 200, staffLogin.data?.staff?.role);
  record("restaurant session me", (await req("GET", "/restaurant-auth/me")).status === 200);

  const rid = staffLogin.data?.restaurant?.id || restaurantId;
  const restaurantEndpoints = [
    ["restaurant orders", `/restaurants/${rid}/orders`],
    ["restaurant tables", `/restaurants/${rid}/tables`],
    ["restaurant menu", `/restaurants/${rid}/items`],
    ["restaurant queue", `/restaurants/${rid}/queue`],
    ["restaurant reservations", `/restaurants/${rid}/reservations`],
    ["restaurant spa", `/restaurants/${rid}/spa/services`],
    ["restaurant documents", `/restaurants/${rid}/documents`],
    ["restaurant signage", `/restaurants/${rid}/signage`],
  ];
  for (const [name, path] of restaurantEndpoints) {
    const r = await req("GET", path);
    record(name, r.status === 200, r.status !== 200 ? `status ${r.status}` : "");
  }

  // ── SUPER ADMIN PANEL ──
  console.log("\n--- Super admin panel ---");
  cookie = "";
  const adminLogin = await req("POST", "/auth/login", {
    email: process.env.ADMIN_EMAIL || "superadmin@fastapmenu.com",
    password: process.env.ADMIN_PASSWORD || "Admin@123",
  });
  record("super admin login", adminLogin.status === 200, adminLogin.data?.user?.role);
  record("super admin me", (await req("GET", "/auth/me")).status === 200);
  record("super admin KYC list", (await req("GET", "/superadmin/kyc")).status === 200);
  record("super admin vendors", (await req("GET", "/superadmin/vendors")).status === 200);
  record("super admin payments", (await req("GET", "/superadmin/payments")).status === 200);

  // ── WEB PANELS (static routes) ──
  console.log("\n--- Web UI routes ---");
  const webRoutes = [
    ["/", "guest home"],
    ["/user/menu?slug=spice-garden&table=T-12", "user menu"],
    ["/user/auth", "user auth"],
    ["/restaurant/login", "restaurant login"],
    ["/restaurant/subscription", "restaurant subscription"],
    ["/restaurant/register", "restaurant register"],
    ["/admin/login", "super admin login"],
  ];
  for (const [route, label] of webRoutes) {
    try {
      const r = await fetch(`${WEB}${route}`);
      record(`web ${label}`, r.status === 200);
    } catch (e) {
      record(`web ${label}`, false, e.message);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\n${passed}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAll 3 panels connected and APIs healthy.\n");
}

main().catch(e => { console.error(e); process.exit(1); });
