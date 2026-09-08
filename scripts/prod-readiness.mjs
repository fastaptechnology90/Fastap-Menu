/**
 * Production readiness audit.
 *
 * Walks the business flows a real venue depends on — onboarding, the order lifecycle,
 * money, roles, the hotel chain, and the platform owner's own job — over HTTP, and
 * checks the database afterwards. It changes nothing in the application; it only
 * reports what a restaurant opening tomorrow would and would not be able to do.
 *
 *   node scripts/prod-readiness.mjs
 *
 * Rows it creates are prefixed AUDIT- and removed at the end.
 */

const API = process.env.API_BASE || "http://localhost:8080/api";

const findings = [];
let group = "";

function section(name) {
  group = name;
  console.log(`\n── ${name} ──`);
}

/**
 * `state` is what a real venue would see:
 *   works    — does what an operator would expect
 *   partial  — does something, but not the whole job
 *   broken   — accepted and did not do it, or refused when it should not have
 *   missing  — no implementation at all
 */
function note(state, what, evidence = "") {
  findings.push({ group, state, what, evidence });
  const mark = { works: "  ok    ", partial: "  PARTIAL", broken: "  BROKEN ", missing: "  MISSING" }[state];
  console.log(`${mark} ${what}${evidence ? `  — ${evidence}` : ""}`);
}

function client() {
  let cookie = "";
  return async function call(method, path, body, extraHeaders = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...extraHeaders,
      },
      ...(body === undefined || method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
}

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let pg;
async function db(sql, params = []) {
  if (!pg) {
    const { Client } = require("../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js");
    pg = new Client({ connectionString: "postgresql://fastapmenu:fastapmenu@localhost:5455/fastapmenu" });
    await pg.connect();
  }
  return (await pg.query(sql, params)).rows;
}

const RID = 1;                       // The Grand Spice
const HOTEL = 5;                     // Hotel Meghdoot Residency
const money = n => Math.round(Number(n) * 100) / 100;

async function main() {
  console.log(`\n=== Production readiness ===\nAPI: ${API}\n`);

  const owner = client();
  const superAdmin = client();
  const guest = client();

  const ownerLogin = await owner("POST", "/restaurant-auth/login", {
    email: "owner@spicegarden.com", password: "Staff@123",
  });
  const adminLogin = await superAdmin("POST", "/auth/login", {
    email: "superadmin@fastapmenu.com", password: "Admin@123",
  });
  if (ownerLogin.status !== 200 || adminLogin.status !== 200) {
    console.error("could not sign in — is the stack running and seeded?");
    process.exit(1);
  }

  // ───────────────────────── ONBOARDING ─────────────────────────
  section("Onboarding a new restaurant");

  const stamp = Date.now().toString().slice(-6);
  const anon = client();
  const signup = await anon("POST", "/restaurant-auth/register", {
    staffRole: "owner",
    restaurantName: `AUDIT Bistro ${stamp}`,
    ownerName: "Audit Owner",
    ownerEmail: `audit${stamp}@example.com`,
    ownerPassword: "Audit@12345",
    ownerPhone: `98${stamp}0000`.slice(0, 10),
    businessType: "restaurant",
    address: "12 Audit Road",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452001",
    restaurantPhone: `97${stamp}0000`.slice(0, 10),
    legalBusinessName: `AUDIT Bistro ${stamp} Pvt Ltd`,
    bankAccount: "000111222333",
    ifsc: "HDFC0001234",
  });
  const newRid = signup.body?.restaurant?.id ?? signup.body?.restaurantId ?? null;
  note(signup.status < 300 && newRid ? "works" : "broken",
    "a restaurant can register itself", `HTTP ${signup.status}${newRid ? `, id ${newRid}` : ""}`);

  if (newRid) {
    // Publication and KYC state live in the settings blob rather than their own columns,
    // which is itself worth knowing — neither can be indexed or reported on directly.
    const fresh = await db("select is_active, plan, settings from restaurants where id=$1", [newRid]);
    const r = fresh[0] ?? {};
    const settings = r.settings ?? {};
    note(settings.publication || settings.kyc ? "works" : "partial",
      "a new venue starts in a defined, queryable state",
      `active=${r.is_active} plan=${r.plan} publication=${JSON.stringify(settings.publication ?? null)} kyc=${JSON.stringify(settings.kyc ?? null)}`);

    const guestSees = await anon("GET", `/public/menu/audit-bistro-${stamp}`);
    note(guestSees.status === 200 ? "broken" : "works",
      "an unapproved venue is not yet visible to guests", `guest menu HTTP ${guestSees.status}`);
  }

  // Plan limits
  const plans = await superAdmin("GET", "/superadmin/plans");
  const planRows = Array.isArray(plans.body) ? plans.body : (plans.body?.plans ?? []);
  const limited = planRows.find(p => Number(p.maxStaff) > 0);
  if (limited) {
    const staffNow = (await db("select count(*)::int n from staff where restaurant_id=$1", [RID]))[0].n;
    note("partial", "plans declare limits",
      `e.g. ${limited.name} maxStaff=${limited.maxStaff}; venue ${RID} already has ${staffNow} staff`);
  } else {
    note("missing", "plans declare limits", "no plan carries a staff limit");
  }

  // ───────────────────────── ORDER TO CASH ─────────────────────────
  section("Order to cash");

  const menu = await guest("GET", "/public/menu/spice-garden");
  const dish = (menu.body?.categories ?? []).flatMap(c => c.items ?? [])[0];
  note(dish ? "works" : "broken", "guest menu loads", dish ? `${dish.name} at ₹${dish.price}` : "no items");

  const channels = ["dine_in", "takeaway", "delivery", "room_service"];
  for (const type of channels) {
    const placed = await guest("POST", "/public/orders", {
      restaurantId: RID, tableName: "AUDIT-T1", customerName: "AUDIT Guest",
      customerPhone: "9000099000", type,
      items: [{ menuItemId: dish.id, quantity: 1 }],
    });
    note(placed.status < 300 ? "works" : "broken", `order can be placed — ${type}`, `HTTP ${placed.status}`);
    if (placed.body?.id) await db("delete from orders where id=$1", [placed.body.id]);
  }

  // One order, followed through every screen that shows its money.
  const tracked = await guest("POST", "/public/orders", {
    restaurantId: RID, tableName: "AUDIT-MONEY", customerName: "AUDIT Money",
    customerPhone: "9000099001", items: [{ menuItemId: dish.id, quantity: 2 }],
  });
  const orderId = tracked.body?.id;
  if (orderId) {
    const row = (await db("select subtotal, tax, total, tip_amount, discount_amount from orders where id=$1", [orderId]))[0];
    const sum = money(Number(row.subtotal) + Number(row.tax) + Number(row.tip_amount) - Number(row.discount_amount));
    note(sum === money(row.total) ? "works" : "broken",
      "subtotal + tax + tip − discount equals the total",
      `${row.subtotal} + ${row.tax} + ${row.tip_amount} − ${row.discount_amount} = ${sum} vs total ${row.total}`);

    const inList = await owner("GET", `/restaurants/${RID}/orders`);
    const found = (Array.isArray(inList.body) ? inList.body : []).find(o => o.id === orderId);
    note(found ? "works" : "broken", "the order reaches the restaurant's order list");
    note(found && money(found.total) === money(row.total) ? "works" : "broken",
      "the list shows the same total as the database", found ? `${found.total} vs ${row.total}` : "");
  }

  // Lifecycle
  if (orderId) {
    for (const status of ["accepted", "preparing", "ready", "served", "completed"]) {
      const step = await owner("PUT", `/restaurants/${RID}/orders/${orderId}`, { status });
      note(step.status === 200 ? "works" : "broken", `order can move to ${status}`, `HTTP ${step.status}`);
    }
    const nonsense = await owner("PUT", `/restaurants/${RID}/orders/${orderId}`, { status: "banana" });
    note(nonsense.status === 200 ? "broken" : "works",
      "an invalid status is refused", `HTTP ${nonsense.status} — a state machine ${nonsense.status === 200 ? "does not exist" : "exists"}`);
  }

  // Payment methods — which record anything
  for (const method of ["cash", "card", "upi", "wallet"]) {
    const paid = await owner("PUT", `/restaurants/${RID}/orders/${orderId}`, {
      paymentMethod: method, paymentStatus: "paid", status: "completed", collectedBy: "AUDIT",
    });
    const ledger = await db(
      "select count(*)::int n from finance_transactions where order_id = $1", [orderId],
    ).catch(() => [{ n: -1 }]);
    note(paid.status === 200 ? "works" : "broken", `payment method accepted — ${method}`,
      `HTTP ${paid.status}, ledger rows ${ledger[0]?.n ?? "?"}`);
  }

  // Everyday actions
  const everyday = {
    "move a tab to another table": ["PUT", `/restaurants/${RID}/orders/${orderId}/move`],
    "merge two tables": ["POST", `/restaurants/${RID}/tables/merge`],
    "split a bill": ["POST", `/restaurants/${RID}/orders/${orderId}/split`],
    "void a billed item": ["POST", `/restaurants/${RID}/orders/${orderId}/void`],
    "comp an item": ["POST", `/restaurants/${RID}/orders/${orderId}/comp`],
    "reprint a bill": ["POST", `/restaurants/${RID}/orders/${orderId}/reprint`],
    "refund an order": ["POST", `/restaurants/${RID}/orders/${orderId}/refund`],
    "day-end Z report": ["GET", `/restaurants/${RID}/reports/z`],
    "clock in / attendance": ["POST", `/restaurants/${RID}/attendance`],
  };
  for (const [what, [method, path]] of Object.entries(everyday)) {
    const r = await owner(method, path, method === "GET" ? undefined : {});
    note(r.status === 404 ? "missing" : r.status < 400 ? "works" : "partial", what, `HTTP ${r.status}`);
  }

  if (orderId) await db("delete from orders where id=$1", [orderId]);

  // ───────────────────────── ROLES ─────────────────────────
  section("Roles inside a restaurant");

  const roleProbe = [
    ["waiter@spicegarden.com", "waiter"],
    ["cashier@spicegarden.com", "cashier"],
    ["kitchen@spicegarden.com", "kitchen"],
  ];
  for (const [email, role] of roleProbe) {
    const staff = client();
    const login = await staff("POST", "/restaurant-auth/login", { email, password: "Staff@123" });
    if (login.status !== 200) { note("partial", `${role} can sign in`, `HTTP ${login.status}`); continue; }
    note("works", `${role} can sign in`);

    const checks = {
      "read finance": ["GET", `/restaurants/${RID}/finance/summary`],
      "remove staff": ["DELETE", `/restaurants/${RID}/staff/6`],
      "reprice the menu": ["PUT", `/restaurants/${RID}/items/1`],
      "rewrite permissions": ["PUT", `/restaurants/${RID}/rbac`],
    };
    for (const [what, [method, path]] of Object.entries(checks)) {
      const r = await staff(method, path, method === "GET" ? undefined : {});
      note(r.status === 403 ? "works" : "broken", `${role} is refused: ${what}`, `HTTP ${r.status}`);
    }
  }

  // ───────────────────────── HOTEL CHAIN ─────────────────────────
  section("Hotel: room service to checkout");

  const roomOrder = await guest("POST", "/public/room-service", {
    restaurantId: HOTEL, roomNumber: "101", guestName: "AUDIT Guest",
    guestPhone: "9000099002", type: "food", total: 250,
    items: [{ name: "Audit dish", qty: 1, price: 250 }],
  });
  note(roomOrder.status < 300 ? "works" : "broken", "a room guest can order", `HTTP ${roomOrder.status}`);

  const mirrored = await db(
    "select id from orders where restaurant_id=$1 and type='room_service' and customer_name='AUDIT Guest'", [HOTEL],
  );
  note(mirrored.length ? "works" : "broken", "the room order reaches the kitchen");

  // The hotel's own owner — venue 1's owner is correctly refused here by tenant scoping,
  // so using them would measure the wrong thing.
  const hotelOwner = client();
  const hotelLogin = await hotelOwner("POST", "/restaurant-auth/login", {
    email: "devendra.rathore@meghdootresidency.in", password: "Fastap@2026",
  });
  note(hotelLogin.status === 200 ? "works" : "broken", "the hotel's own owner can sign in", `HTTP ${hotelLogin.status}`);

  const folio = await hotelOwner("GET", `/restaurants/${HOTEL}/room-service`);
  note(folio.status === 200 ? "works" : "partial", "reception can see room service requests", `HTTP ${folio.status}`);

  const hk = await hotelOwner("GET", `/restaurants/${HOTEL}/housekeeping`);
  note(hk.status === 200 ? "works" : "partial", "housekeeping tasks are listable", `HTTP ${hk.status}`);

  for (const id of mirrored.map(r => r.id)) await db("delete from orders where id=$1", [id]);
  await db("delete from room_service_requests where guest_name='AUDIT Guest'");

  // ───────────────────────── PLATFORM ─────────────────────────
  section("Platform owner");

  const vendors = await superAdmin("GET", "/superadmin/vendors");
  const vendorRows = Array.isArray(vendors.body) ? vendors.body : (vendors.body?.vendors ?? []);
  const dbVenues = (await db("select count(*)::int n from restaurants"))[0].n;
  note(vendorRows.length === dbVenues ? "works" : "partial",
    "the vendor list matches the database", `${vendorRows.length} listed vs ${dbVenues} in DB`);

  const revenue = await superAdmin("GET", "/superadmin/restaurant-revenues");
  const revRows = Array.isArray(revenue.body) ? revenue.body : (revenue.body?.rows ?? []);
  const dbRevenue = (await db(
    "select coalesce(sum(total),0)::numeric t from orders where restaurant_id=$1 and payment_status='paid'", [RID],
  ))[0].t;
  const claimed = revRows.find(r => String(r.id ?? r.restaurantId) === String(RID));
  note(claimed ? "partial" : "missing", "platform revenue per venue is reported",
    claimed ? `claims ${claimed.revenue ?? claimed.total ?? "?"}, DB paid total ${dbRevenue}` : "");

  const appReleases = await superAdmin("GET", "/superadmin/app-releases");
  note(appReleases.status === 200 ? "works" : "broken", "APK releases are listable", `HTTP ${appReleases.status}`);
  const anyDownloadRecord = await db(
    "select count(*)::int n from information_schema.tables where table_name = 'app_downloads'",
  );
  note(anyDownloadRecord[0].n ? "works" : "missing", "who downloaded which app is recorded");

  // ───────────────────────── SUMMARY ─────────────────────────
  const counts = findings.reduce((acc, f) => ({ ...acc, [f.state]: (acc[f.state] ?? 0) + 1 }), {});
  console.log("\n" + "=".repeat(70));
  console.log(`works ${counts.works ?? 0}  ·  partial ${counts.partial ?? 0}  ·  broken ${counts.broken ?? 0}  ·  missing ${counts.missing ?? 0}`);

  for (const state of ["broken", "missing", "partial"]) {
    const rows = findings.filter(f => f.state === state);
    if (!rows.length) continue;
    console.log(`\n${state.toUpperCase()} (${rows.length}):`);
    for (const r of rows) console.log(`  [${r.group}] ${r.what}${r.evidence ? ` — ${r.evidence}` : ""}`);
  }

  await db("delete from restaurants where name like 'AUDIT %'").catch(() => {});
  if (pg) await pg.end();
}

main().catch(async err => {
  console.error("\naudit could not complete:", err);
  if (pg) await pg.end();
  process.exit(1);
});
