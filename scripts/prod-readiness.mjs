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

    // Seeing the menu while onboarding is deliberate — an owner needs to preview it.
    // Taking a real customer's order before anyone has checked the business is not.
    const guestSees = await anon("GET", `/public/menu/audit-bistro-${stamp}`);
    note(guestSees.status === 200 ? "works" : "partial",
      "an onboarding venue can preview its own menu", `HTTP ${guestSees.status}`);

    const tryOrder = await anon("POST", "/public/orders", {
      restaurantId: newRid, tableName: "AUDIT-T1", customerName: "AUDIT",
      items: [{ menuItemId: 1, quantity: 1 }],
    });
    note(tryOrder.status === 403 ? "works" : "broken",
      "an unapproved venue cannot take real orders",
      `HTTP ${tryOrder.status}${tryOrder.body?.publicationStatus ? ` (${tryOrder.body.publicationStatus})` : ""}`);
  }

  // Plan limits
  const plans = await superAdmin("GET", "/superadmin/plans");
  const planRows = Array.isArray(plans.body) ? plans.body : (plans.body?.plans ?? []);
  const limited = planRows.find(p => Number(p.maxStaff) > 0);
  if (limited) {
    // Declaring a limit is not the point — enforcing it is, and it has to be checked
    // against the plan a venue is actually on. Venue 6 is on Starter, a few staff short
    // of its cap, and has a working owner login; a freshly registered venue cannot be
    // used here because it is held at the KYC gate before it can add anyone.
    const CAPPED_VENUE = 6;
    const capVenue = (await db("select plan from restaurants where id=$1", [CAPPED_VENUE]))[0];
    const capRow = planRows.find(p => String(p.name).toLowerCase() === String(capVenue?.plan).toLowerCase());
    const cap = Number(capRow?.maxStaff ?? 0);

    const owned = client();
    const signIn = await owned("POST", "/restaurant-auth/login", {
      email: "farah.mistry@bombaybun.in", password: "Fastap@2026",
    });

    if (cap > 0 && signIn.status === 200) {
      const added = [];
      let lastStatus = 200;
      let lastBody = null;
      for (let i = 0; i < cap + 2 && lastStatus < 400; i++) {
        const add = await owned("POST", `/restaurants/${CAPPED_VENUE}/staff`, {
          name: `AUDIT Cap ${stamp}-${i}`, email: `auditcap${stamp}-${i}@example.com`,
          role: "waiter", phone: `95${stamp}${String(i).padStart(2, "0")}`.slice(0, 10),
          password: "Audit@1234",
        });
        lastStatus = add.status;
        lastBody = add.body;
        if (add.status < 300 && add.body?.id) added.push(add.body.id);
      }

      const capped = lastStatus === 402 && Number(lastBody?.limit?.allowed) === cap;
      note(capped ? "works" : "broken", "plan limits are enforced, not just declared",
        `${capRow.name} allows ${cap} staff — creating past it returned HTTP ${lastStatus}` +
        (lastBody?.limit ? ` at ${lastBody.limit.current}` : ""));

      // Being over a cap must not lock a venue out of what it already has, or it can
      // never reduce its way back under one it has been moved onto.
      const stillReadable = await owned("GET", `/restaurants/${CAPPED_VENUE}/staff`);
      note(stillReadable.status === 200 ? "works" : "broken",
        "a venue at its cap can still manage the staff it has", `HTTP ${stillReadable.status}`);

      for (const id of added) await db("delete from staff where id=$1", [id]);
    } else {
      note("partial", "plan limits are enforced, not just declared",
        `could not reach a capped venue (plan ${capVenue?.plan ?? "?"}, login HTTP ${signIn.status})`);
    }
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

  // Everyday actions, exercised the way a floor actually uses them. Posting an empty
  // body and grading a 400 as "partial" told us nothing: "a reason is required" IS the
  // endpoint working. Each action below is given a real payload and its effect checked.
  const everyday = {
    "X reading (mid-service)": ["GET", `/restaurants/${RID}/reports/x`],
    "day-end Z report": ["GET", `/restaurants/${RID}/reports/z?force=true`],
    "clock in / attendance": ["GET", `/restaurants/${RID}/attendance/open`],
  };
  for (const [what, [method, path]] of Object.entries(everyday)) {
    const r = await owner(method, path, method === "GET" ? undefined : {});
    note(r.status === 404 ? "missing" : r.status < 400 ? "works" : "partial", what, `HTTP ${r.status}`);
  }

  // A fresh unpaid tab of two lines, so voiding, splitting and moving have something to
  // act on without disturbing the paid order above.
  const dish2 = (menu.body?.categories ?? []).flatMap(c => c.items ?? [])[1] ?? dish;
  const tab = await guest("POST", "/public/orders", {
    restaurantId: RID, tableName: "AUDIT-FLOOR", customerName: "AUDIT Floor",
    customerPhone: "9000099003",
    items: [{ menuItemId: dish.id, quantity: 1 }, { menuItemId: dish2.id, quantity: 1 }],
  });
  const tabId = tab.body?.id;

  if (tabId) {
    const noReason = await owner("POST", `/restaurants/${RID}/orders/${tabId}/void-item`, { itemIndex: 0 });
    note(noReason.status === 400 ? "works" : "broken",
      "voiding without a reason is refused", `HTTP ${noReason.status}`);

    const voided = await owner("POST", `/restaurants/${RID}/orders/${tabId}/void-item`,
      { itemIndex: 0, reason: "AUDIT — keyed twice" });
    const afterVoid = (await db("select subtotal, total from orders where id=$1", [tabId]))[0];
    note(voided.status === 200 && Number(afterVoid.subtotal) > 0 ? "works" : "broken",
      "void a billed item", `HTTP ${voided.status}, bill now ${afterVoid?.total}`);

    const comped = await owner("POST", `/restaurants/${RID}/orders/${tabId}/comp-item`,
      { itemIndex: 1, reason: "AUDIT — sent cold" });
    const afterComp = (await db("select total from orders where id=$1", [tabId]))[0];
    note(comped.status === 200 && money(afterComp.total) === 0 ? "works" : "partial",
      "comp an item", `HTTP ${comped.status}, bill now ${afterComp?.total}`);

    const history = await owner("GET", `/restaurants/${RID}/orders/${tabId}/adjustments`);
    const entries = history.body?.adjustments ?? [];
    note(entries.length >= 2 && entries.every(a => a.reason) ? "works" : "broken",
      "every adjustment is recorded with a reason and a person",
      `${entries.length} entries`);

    const printed = await owner("POST", `/restaurants/${RID}/orders/${tabId}/reprint`, { kind: "bill" });
    note(printed.status === 200 && typeof printed.body?.html === "string" ? "works" : "partial",
      "print a bill", `HTTP ${printed.status}, copy ${printed.body?.copy ?? "?"}`);

    const kot = await owner("POST", `/restaurants/${RID}/orders/${tabId}/reprint`, { kind: "kot" });
    note(kot.status === 200 ? "works" : "partial", "print a kitchen ticket", `HTTP ${kot.status}`);

    const refundEarly = await owner("POST", `/restaurants/${RID}/orders/${tabId}/refund`,
      { reason: "AUDIT — never collected" });
    note(refundEarly.status >= 400 ? "works" : "broken",
      "refunding money that was never collected is refused", `HTTP ${refundEarly.status}`);
  }

  // A second unpaid tab, so split, merge and move each have a real target.
  const tabB = await guest("POST", "/public/orders", {
    restaurantId: RID, tableName: "AUDIT-FLOOR-B", customerName: "AUDIT Floor B",
    customerPhone: "9000099004",
    items: [{ menuItemId: dish.id, quantity: 2 }, { menuItemId: dish2.id, quantity: 1 }],
  });
  const tabBId = tabB.body?.id;

  if (tabBId) {
    const before = (await db("select total from orders where id=$1", [tabBId]))[0];
    const split = await owner("POST", `/restaurants/${RID}/orders/${tabBId}/split`, { itemIndexes: [1] });
    const parts = [split.body?.original?.total, split.body?.split?.total].map(Number);
    note(split.status === 201 && parts.every(Number.isFinite) ? "works" : "partial",
      "split a bill", `HTTP ${split.status}, ${before?.total} → ${parts.join(" + ")}`);

    const childId = split.body?.split?.id;
    if (childId) {
      const merged = await owner("POST", `/restaurants/${RID}/orders/merge`,
        { intoOrderId: tabBId, fromOrderIds: [childId] });
      note(merged.status === 200 && money(merged.body?.order?.total) === money(before?.total) ? "works" : "partial",
        "merge two tabs", `HTTP ${merged.status}, back to ${merged.body?.order?.total}`);
    }

    const freeTable = (await db(
      "select name from tables_map where restaurant_id=$1 and current_order_id is null order by id limit 1", [RID],
    ))[0];
    if (freeTable) {
      const moved = await owner("POST", `/restaurants/${RID}/orders/${tabBId}/move-table`,
        { tableName: freeTable.name });
      note(moved.status === 200 ? "works" : "partial",
        "move a tab to another table", `HTTP ${moved.status} → ${moved.body?.movedTo ?? "?"}`);
    }
  }

  // Everything this section created, including the paid order used to check the money
  // arithmetic — an audit that leaves paid rows behind quietly moves the venue's revenue.
  for (const id of [orderId, tabId, tabBId]) {
    if (id) await db("delete from orders where id=$1 or (metadata->>'splitFrom')::int = $1", [id]);
  }
  await db("delete from orders where restaurant_id=$1 and customer_name like 'AUDIT%'", [RID]);
  await db("update tables_map set status='free', current_order_id=null where restaurant_id=$1 and current_order_id is not null and current_order_id not in (select id from orders)", [RID]);

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

  // Room food is priced from the hotel's own menu, so the line has to name a menu row —
  // posting a made-up dish at a made-up price is exactly what the server now refuses.
  const hotelMenu = await guest("GET", "/public/menu/meghdoot-residency");
  const hotelDish = (hotelMenu.body?.categories ?? []).flatMap(c => c.items ?? [])[0];
  const roomOrder = await guest("POST", "/public/room-service", {
    restaurantId: HOTEL, roomNumber: "101", guestName: "AUDIT Guest",
    guestPhone: "9000099002", type: "food",
    items: hotelDish ? [{ menuItemId: hotelDish.id, qty: 1 }] : [],
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
  const revRows = revenue.body?.restaurants ?? (Array.isArray(revenue.body) ? revenue.body : []);
  // Same exclusions the report applies: a cancelled or refunded order is not revenue.
  const dbRevenue = Number((await db(
    `select coalesce(sum(total),0)::numeric t from orders
     where restaurant_id=$1 and payment_status='paid'
       and status <> 'cancelled' and payment_status not in ('refunded','failed')`, [RID],
  ))[0].t);
  const claimed = revRows.find(r => String(r.id) === String(RID));
  const matches = claimed && money(claimed.orderRevenue) === money(dbRevenue);
  note(!claimed ? "missing" : matches ? "works" : "broken",
    "platform revenue per venue reconciles with the database",
    claimed ? `report ${claimed.orderRevenue} vs DB ${dbRevenue}` : "");

  const appReleases = await superAdmin("GET", "/superadmin/app-releases");
  note(appReleases.status === 200 ? "works" : "broken", "APK releases are listable", `HTTP ${appReleases.status}`);
  const downloadReport = await superAdmin("GET", "/superadmin/app-releases/downloads");
  note(downloadReport.status === 200 ? "works" : "missing",
    "who downloaded which app is recorded", `HTTP ${downloadReport.status}`);

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
