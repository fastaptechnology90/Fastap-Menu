#!/usr/bin/env node
/**
 * Integration test: unpublished restaurants must return zero analytics.
 * Requires API server running at API_BASE (default http://127.0.0.1:8080/api).
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:8080/api";
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

function assertZero(name, value) {
  record(name, value === 0 || value === "0" || value === 0.0, `got ${value}`);
}

async function main() {
  console.log(`\nAnalytics publication test — ${BASE}\n`);
  const stamp = Date.now();
  const email = `pub-test-${stamp}@fastap.test`;

  const register = await req("POST", "/restaurant-auth/register", {
    ownerName: "Pub Test Owner",
    ownerEmail: email,
    ownerPassword: "PubTest1!",
    ownerPhone: `98765${String(stamp).slice(-5)}`,
    restaurantName: `Pub Test ${stamp}`,
    businessType: "restaurant",
    address: "1 Test Street",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    restaurantPhone: `98765${String(stamp).slice(-5)}`,
    restaurantEmail: email,
    gstNumber: "27AAAAA0000A1Z5",
    fssaiNumber: "10000000000000",
    panNumber: "AAAAA0000A",
    bankAccount: "1234567890",
    ifsc: "HDFC0000001",
    documents: [{ type: "gst_certificate", name: "GST", fileUrl: "https://example.com/gst.pdf" }],
  });

  if (register.status !== 201) {
    console.error("Registration failed:", register.data);
    process.exit(1);
  }

  const restaurantId = register.data?.restaurant?.id;
  record("register unpublished restaurant", Boolean(restaurantId), `id=${restaurantId}`);

  const login = await req("POST", "/restaurant-auth/login", { email, password: "PubTest1!" });
  record("owner login (pending approval)", login.status === 403 || login.status === 200, `status=${login.status}`);

  // Owner session via user auth if staff login blocked
  if (login.status === 403) {
    const ownerLogin = await req("POST", "/auth/login", { email, password: "PubTest1!" });
    record("owner user login", ownerLogin.status === 200, `status=${ownerLogin.status}`);
  }

  const dashboard = await req("GET", `/restaurants/${restaurantId}/dashboard`);
  record("dashboard returns 200", dashboard.status === 200);
  assertZero("dashboard todayOrders", dashboard.data?.todayOrders ?? -1);
  assertZero("dashboard todayRevenue", dashboard.data?.todayRevenue ?? -1);
  assertZero("dashboard totalCustomers", dashboard.data?.totalCustomers ?? -1);
  record("dashboard isPublished false", dashboard.data?.isPublished === false, String(dashboard.data?.isPublished));
  record("dashboard recentOrders empty", Array.isArray(dashboard.data?.recentOrders) && dashboard.data.recentOrders.length === 0);

  const summary = await req("GET", `/restaurants/${restaurantId}/analytics/summary?period=week`);
  record("analytics summary returns 200", summary.status === 200);
  assertZero("summary totalOrders", summary.data?.totalOrders ?? -1);
  assertZero("summary totalRevenue", summary.data?.totalRevenue ?? -1);
  assertZero("summary qrScans", summary.data?.qrScans ?? -1);
  record("summary isPublished false", summary.data?.isPublished === false);

  const dailySales = await req("GET", `/restaurants/${restaurantId}/analytics/daily-sales`);
  record("daily-sales empty array", Array.isArray(dailySales.data) && dailySales.data.length === 0);

  const popular = await req("GET", `/restaurants/${restaurantId}/analytics/popular-items`);
  record("popular-items empty array", Array.isArray(popular.data) && popular.data.length === 0);

  const orderStats = await req("GET", `/restaurants/${restaurantId}/analytics/order-stats`);
  record("order-stats hourlyOrders empty", Array.isArray(orderStats.data?.hourlyOrders) && orderStats.data.hourlyOrders.length === 0);

  const financeWallet = await req("GET", `/restaurants/${restaurantId}/finance/wallet`);
  record("finance wallet returns 200", financeWallet.status === 200);
  assertZero("finance wallet balance", financeWallet.data?.balance ?? -1);
  record("finance wallet isPublished false", financeWallet.data?.isPublished === false);

  const branchAnalytics = await req("GET", `/restaurants/${restaurantId}/branches/analytics`);
  record("branch analytics returns zeros", Array.isArray(branchAnalytics.data) && branchAnalytics.data.every(r => r.value === "₹0" || r.value === "0" || r.value === "—"));

  const kioskStats = await req("GET", `/restaurants/${restaurantId}/kiosk/stats`);
  record("kiosk stats today_orders zero", (kioskStats.data?.today_orders ?? -1) === 0);
  record("kiosk stats isPublished false", kioskStats.data?.isPublished === false);

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
