#!/usr/bin/env node
const BASE = process.env.API_BASE || "http://localhost:8080/api";
let cookie = "";
const results = [];

async function req(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const part = c.split(";")[0];
    if (part) cookie = cookie ? `${cookie}; ${part}` : part;
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\nRestaurant panel smoke test — ${BASE}\n`);
  let restaurantId = 1;
  const stamp = Date.now();
  const smokeEmail = `smoke-${stamp}@fastap.test`;

  const register = await req("POST", "/restaurant-auth/register", {
    ownerName: "Smoke Owner",
    ownerEmail: smokeEmail,
    ownerPassword: "SmokeTest1!",
    ownerPhone: `98765${String(stamp).slice(-5)}`,
    restaurantName: `Smoke Venue ${stamp}`,
    businessType: "restaurant",
    address: "1 Test Street",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    restaurantPhone: `98765${String(stamp).slice(-5)}`,
    restaurantEmail: smokeEmail,
    gstNumber: "27AAAAA0000A1Z5",
    fssaiNumber: "10000000000000",
    panNumber: "AAAAA0000A",
    bankAccount: "1234567890",
    ifsc: "HDFC0000001",
    // Registration requires all four business documents. This list used to hold only
    // the GST certificate, so registration was rejected and every later check in this
    // file failed on a missing session — 48 of 60 red, all from one stale line.
    documents: [
      { type: "gst_certificate", name: "GST", fileUrl: "https://example.com/gst.pdf" },
      { type: "fssai_license", name: "FSSAI", fileUrl: "https://example.com/fssai.pdf" },
      { type: "business_registration", name: "Shop Act", fileUrl: "https://example.com/reg.pdf" },
      { type: "bank_proof", name: "Cancelled cheque", fileUrl: "https://example.com/bank.pdf" },
    ],
  });
  record("register + KYC", register.status === 201, register.data?.restaurant?.name);
  if (register.data?.restaurant?.id) restaurantId = register.data.restaurant.id;

  // A restaurant that registers with documents lands in `pending` and cannot sign in
  // until the platform team approves it — that is the flow working, not a fault.
  // This script used to try logging in straight after registering, so every check
  // below it failed on a missing session. Approving here as a super admin mirrors
  // what the onboarding team does, and covers that step too.
  cookie = "";
  const adminLogin = await req("POST", "/auth/login", {
    email: process.env.SMOKE_ADMIN_EMAIL || "superadmin@fastapmenu.com",
    password: process.env.SMOKE_ADMIN_PASSWORD || "Admin@123",
  });
  const approve = adminLogin.status === 200
    ? await req("POST", `/superadmin/kyc/${restaurantId}/approve`)
    : { status: adminLogin.status };
  record("super admin approves KYC", approve.status === 200, `HTTP ${approve.status}`);
  cookie = "";

  const login = await req("POST", "/restaurant-auth/login", {
    email: smokeEmail,
    password: "SmokeTest1!",
  });
  record("staff login", login.status === 200, login.data?.staff?.role);

  const me = await req("GET", "/restaurant-auth/me");
  record("session me", me.status === 200, me.data?.staff?.role);

  // The panel is behind a subscription gate (402 SUBSCRIPTION_REQUIRED) — deliberate,
  // and enforced by its own middleware. A freshly registered restaurant has no plan
  // yet, so every panel check below needs this step first. Together with the approval
  // above, this script now walks the real onboarding path end to end.
  const plans = await req("GET", "/restaurant-auth/subscription/plans");
  const planId = plans.data?.plans?.[0]?.id ?? plans.data?.[0]?.id;
  const subscribe = planId
    ? await req("POST", "/restaurant-auth/subscription/subscribe", { planId })
    : { status: 0 };
  record("subscribe to a plan", subscribe.status === 200, planId ? `plan ${planId}` : "no plans returned");

  const endpoints = [
    ["dashboard", `/restaurants/${restaurantId}/dashboard`],
    ["orders", `/restaurants/${restaurantId}/orders`],
    ["tables", `/restaurants/${restaurantId}/tables`],
    ["menu items", `/restaurants/${restaurantId}/items`],
    ["staff", `/restaurants/${restaurantId}/staff`],
    ["customers", `/restaurants/${restaurantId}/customers`],
    ["reservations", `/restaurants/${restaurantId}/reservations`],
    ["queue", `/restaurants/${restaurantId}/queue`],
    ["inventory", `/restaurants/${restaurantId}/inventory`],
    ["analytics", `/restaurants/${restaurantId}/analytics/summary`],
    ["audit logs", `/restaurants/${restaurantId}/audit-logs`],
    ["notifications", `/restaurants/${restaurantId}/notifications-log`],
    ["documents", `/restaurants/${restaurantId}/documents`],
    ["hardware", `/restaurants/${restaurantId}/hardware`],
    ["loyalty", `/restaurants/${restaurantId}/loyalty`],
    ["reviews", `/restaurants/${restaurantId}/reviews`],
    ["signage", `/restaurants/${restaurantId}/signage`],
    ["kiosk settings", `/restaurants/${restaurantId}/kiosk/settings`],
    ["rbac", `/restaurants/${restaurantId}/rbac`],
    ["bar inventory", `/restaurants/${restaurantId}/bar/inventory`],
    ["bar recipes", `/restaurants/${restaurantId}/bar/recipes`],
    ["platform offline", `/restaurants/${restaurantId}/platform/offline`],
    ["platform aggregators", `/restaurants/${restaurantId}/platform/aggregators`],
    ["platform sandbox", `/restaurants/${restaurantId}/platform/sandbox`],
    ["platform accessibility", `/restaurants/${restaurantId}/platform/accessibility`],
    ["platform api-keys", `/restaurants/${restaurantId}/platform/api-keys`],
    ["waiter calls", `/restaurants/${restaurantId}/waiter-calls`],
    ["promo codes", `/restaurants/${restaurantId}/promo-codes`],
    ["gift cards", `/restaurants/${restaurantId}/gift-cards`],
    ["suppliers", `/restaurants/${restaurantId}/suppliers`],
    ["purchase orders", `/restaurants/${restaurantId}/purchase-orders`],
    ["tasks", `/restaurants/${restaurantId}/tasks`],
    ["sop", `/restaurants/${restaurantId}/sop`],
    ["cash shifts", `/restaurants/${restaurantId}/cash-shifts`],
    ["franchise", `/restaurants/${restaurantId}/franchise`],
    ["stock transfers", `/restaurants/${restaurantId}/stock-transfers`],
    ["branch analytics", `/restaurants/${restaurantId}/branches/analytics`],
    ["marketing automation", `/restaurants/${restaurantId}/marketing/automation`],
    ["monitoring logs", `/restaurants/${restaurantId}/monitoring/logs`],
    ["monitoring history", `/restaurants/${restaurantId}/monitoring/history`],
    ["training videos", `/restaurants/${restaurantId}/training-videos`],
    ["checklists", `/restaurants/${restaurantId}/checklists`],
    ["analytics export", `/restaurants/${restaurantId}/analytics/export`],
    ["finance export", `/restaurants/${restaurantId}/finance/export`],
    ["loyalty transactions", `/restaurants/${restaurantId}/loyalty/transactions`],
  ];

  for (const [name, path] of endpoints) {
    const r = await req("GET", path);
    record(name, r.status === 200, `status ${r.status}`);
  }

  const logout = await req("POST", "/restaurant-auth/logout", {});
  record("logout", logout.status === 200);

  const webRoutes = [
    "/restaurant/login", "/restaurant/register", "/restaurant/dashboard", "/restaurant/orders",
    "/restaurant/menu", "/restaurant/audit", "/restaurant/notifications", "/restaurant/documents",
    "/restaurant/offline", "/restaurant/aggregators", "/restaurant/waiter",
  ];
  const WEB = process.env.WEB_BASE || "https://digitalrestuarants.thefingo.com";
  for (const route of webRoutes) {
    try {
      const r = await fetch(`${WEB}${route}`);
      record(`web ${route}`, r.status === 200);
    } catch (e) {
      record(`web ${route}`, false, e.message);
    }
  }

  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed < results.length) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
