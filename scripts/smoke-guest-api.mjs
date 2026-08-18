#!/usr/bin/env node
/** Smoke-test guest public API endpoints and key flows. */
const BASE = process.env.API_BASE || "http://localhost:8080/api";
const SLUG = "spice-garden";
const today = new Date().toISOString().split("T")[0];

const results = [];
let restaurantId = 1;
let orderId = null;
let cookie = "";

async function req(method, path, body) {
  const url = `${BASE}${path}`;
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const part = c.split(";")[0];
    if (part) cookie = cookie ? `${cookie}; ${part}` : part;
  }
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
    const buf = await res.arrayBuffer();
    data = { pdfBytes: buf.byteLength, pdfHeader: buf.byteLength >= 4 ? new TextDecoder().decode(buf.slice(0, 4)) : "" };
  } else {
    const text = await res.text();
    data = text.slice(0, 200);
  }
  return { status: res.status, data };
}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(name, path, expect = 200) {
  const r = await req("GET", path);
  const ok = r.status === expect;
  record(name, ok, ok ? "" : `status ${r.status}`);
  return r;
}

async function post(name, path, body, expect = 200) {
  const r = await req("POST", path, body);
  const ok = r.status === expect || r.status === 201;
  record(name, ok, ok ? "" : `status ${r.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);
  return r;
}

async function main() {
  console.log(`\nSmoke testing ${BASE}\n`);

  await get("health", "/health");
  const venue = await get("venue", `/public/venue/${SLUG}?table=T-12`);
  if (venue.data?.restaurant?.id) restaurantId = venue.data.restaurant.id;
  record("venue has restaurant", !!venue.data?.restaurant?.name, venue.data?.restaurant?.name);

  await get("menu", `/public/menu/${SLUG}`);
  await get("auth oauth-config", "/public/auth/oauth-config");
  await get("auth guest-types", "/public/auth/guest-types");
  await get("future-ai catalog", "/public/ai-future/catalog");
  await get("social catalog", "/public/social/catalog");
  await get("social ratings", `/public/social/ratings/${SLUG}`);
  await get("payments catalog", "/public/payments/catalog");
  await get("queue stats", `/public/queue/stats/${restaurantId}?partySize=2`);
  await get("reservation types", "/public/reservations/types");
  await get("reservation slots", `/public/reservations/slots?restaurantId=${restaurantId}&date=${today}&reservationType=table`);
  await get("bar catalog", `/public/bar/catalog/${restaurantId}`);
  await get("events catalog", `/public/events/catalog/${restaurantId}`);
  await get("spa services", `/public/spa/services/${restaurantId}`);
  await get("wallet catalog", "/public/wallet/catalog");
  await get("loyalty catalog", "/public/loyalty/catalog");
  await get("ai personalized menu", `/public/ai/personalized-menu/${restaurantId}`);
  await get("support config", `/public/support/config/${restaurantId}`);
  await get("offline status", "/public/offline/status");
  await get("pwa catalog", "/public/pwa/catalog");
  await get("locale catalog", "/public/locale/catalog");
  await get("kiosk catalog", "/public/kiosk/catalog");
  await get("digital experience", "/public/digital-experience/catalog");
  await get("seating catalog", "/public/seating/catalog");
  await get("hotel room 501", `/public/hotel/room/${restaurantId}/501`);

  const otpSend = await post("otp send", "/public/auth/otp/send", { phone: "9876543210" });
  const otpCode = otpSend.data?.devOtp || process.env.DEMO_OTP || "123456";
  const otpVerify = await post("otp verify", "/public/auth/otp/verify", {
    phone: "9876543210",
    otp: otpCode,
    name: "Rahul Sharma",
    restaurantId,
  });
  record("auth session", !!otpVerify.data?.user, otpVerify.data?.user?.name);
  await get("auth me", "/public/auth/me");

  const coupon = await post("validate coupon HAPPY20", "/public/coupons/validate", {
    restaurantId,
    code: "HAPPY20",
    subtotal: 500,
  });
  record("coupon HAPPY20", coupon.status === 200 && coupon.data?.discount > 0, `discount ${coupon.data?.discount}`);

  const badCoupon = await post("reject invalid coupon", "/public/coupons/validate", {
    restaurantId,
    code: "INVALID99",
    subtotal: 500,
  }, 404);
  record("invalid coupon rejected", badCoupon.status === 404);

  const corpQueue = await post("corporate queue GRANDSPICE", "/public/queue", {
    restaurantId,
    guestName: "Test Corp",
    guestPhone: "+919999999999",
    partySize: 2,
    queueType: "corporate",
    corporateCode: "GRANDSPICE",
    notifyVia: "app",
  }, 201);
  record("corporate priority", corpQueue.data?.priority === "corporate", corpQueue.data?.priority);

  const badCorp = await post("queue join", "/public/queue", {
    restaurantId,
    guestName: "Test Normal",
    guestPhone: "+919999999998",
    partySize: 2,
    queueType: "corporate",
    corporateCode: "FAKECODE",
    notifyVia: "app",
  }, 201);
  record("fake corp code = normal", badCorp.data?.priority !== "corporate", badCorp.data?.priority);

  const orders = await get("my orders", "/public/me/orders");
  const orderList = orders.data?.orders ?? orders.data ?? [];
  if (orderList[0]?.id) orderId = orderList[0].id;
  if (!orderId) {
    const menuItems = await req("GET", `/public/menu/${SLUG}`);
    const item = menuItems.data?.items?.[0] || menuItems.data?.categories?.[0]?.items?.[0];
    if (item?.id) {
      const placed = await post("place order", "/public/orders", {
        restaurantId,
        tableName: "T-12",
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        items: [{ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }],
      }, 201);
      orderId = placed.data?.order?.id ?? placed.data?.id;
    }
  }
  if (orderId) {
    await get("order status", `/public/orders/${orderId}/status`);
    const pdf = await get("invoice pdf", `/public/payments/invoice/${orderId}/pdf`);
    const pdfOk = pdf.status === 200 && pdf.data?.pdfBytes > 100 && pdf.data?.pdfHeader === "%PDF";
    record("invoice pdf bytes", pdfOk, `${pdf.data?.pdfBytes ?? 0} bytes header=${pdf.data?.pdfHeader ?? "?"}`);
    await get("invoice html", `/public/payments/invoice/${orderId}`);
  } else {
    record("order for invoice test", false, "no order available");
  }

  const webRoutes = [
    "/", "/user/menu?slug=spice-garden&table=T-12", "/user/auth",
    "/user/cart?slug=spice-garden&table=T-12", "/user/profile?slug=spice-garden",
    "/user/security?slug=spice-garden", "/user/future-ai?slug=spice-garden",
    "/user/reviews?slug=spice-garden", "/user/dining?slug=spice-garden&table=T-12",
    "/user/queue?slug=spice-garden", "/user/wallet?slug=spice-garden",
    "/user/support?slug=spice-garden", "/user/experience?slug=spice-garden",
    "/user/reserve?slug=spice-garden", "/user/hotel?slug=spice-garden&room=501",
    "/user/events?slug=spice-garden", "/user/spa?slug=spice-garden",
    "/user/bar?slug=spice-garden", "/user/payment?slug=spice-garden",
    "/user/loyalty?slug=spice-garden", "/user/ai?slug=spice-garden",
    "/user/language?slug=spice-garden", "/user/offline?slug=spice-garden",
    "/user/pwa?slug=spice-garden", "/user/kiosk?slug=spice-garden",
    "/user/seating?slug=spice-garden&table=T-12", "/e/spice-garden?table=T-12",
  ];
  const WEB = process.env.WEB_BASE || "http://localhost:5000";
  for (const route of webRoutes) {
    try {
      const r = await fetch(`${WEB}${route}`);
      record(`web ${route.split("?")[0]}`, r.status === 200);
    } catch (e) {
      record(`web ${route.split("?")[0]}`, false, String(e.message));
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
}

main().catch(e => { console.error(e); process.exit(1); });
