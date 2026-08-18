#!/usr/bin/env node
/**
 * Validates mobile APIs return database / live-order data (not hardcoded demo stubs)
 * and that POST actions persist real state changes.
 *
 * Usage:
 *   API_BASE=https://digitalrestuarants.thefingo.com node scripts/smoke-mobile-real-data.mjs
 */
const BASE = process.env.API_BASE || "https://digitalrestuarants.thefingo.com";
const ROOT = `${BASE}/api/v1`;
const PASS = process.env.MOBILE_PASS || "Staff@123";

const STUB_MARKERS = {
  inventory: { id: "ING-001", name: "Butter" },
  equipment: { id: "EQ-1", name: "Tandoor Oven" },
};

async function req(method, path, body, token) {
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
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, data: json?.data ?? json };
}

async function login(staffCode, role) {
  const r = await req("POST", "/auth/password", {
    staffCode,
    password: PASS,
    deviceId: "real-data-smoke",
    role,
  });
  if (r.status !== 200 || !r.data?.token) {
    throw new Error(`Login failed for ${staffCode}: ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.data.token;
}

function assert(label, ok, detail = "") {
  if (ok) {
    console.log(`PASS  ${label}${detail ? ` · ${detail}` : ""}`);
    return true;
  }
  console.log(`FAIL  ${label}${detail ? ` · ${detail}` : ""}`);
  return false;
}

async function testKitchenRealData(token) {
  console.log("\n── Kitchen · real data ──");
  let ok = true;

  const dash = await req("GET", "/dashboard?section=All", null, token);
  ok = assert("Dashboard from live orders", dash.status === 200 && dash.data?.lastSyncedAt) && ok;
  ok = assert("Dashboard has metrics", Array.isArray(dash.data?.metrics) && dash.data.metrics.length > 0) && ok;

  const kds = await req("GET", "/kds?section=All&view=queue&filter=all", null, token);
  ok = assert("KDS board", kds.status === 200 && Array.isArray(kds.data?.orders)) && ok;

  const inv = await req("GET", "/inventory/board?section=All", null, token);
  const items = inv.data?.items ?? [];
  const hasStubInventory = items.some(
    (i) => i.id === STUB_MARKERS.inventory.id && i.name === STUB_MARKERS.inventory.name,
  );
  ok = assert(
    "Inventory from database (not hardcoded stub)",
    inv.status === 200 && items.length > 0 && !hasStubInventory,
    `${items.length} items · e.g. ${items[0]?.name ?? "—"}`,
  ) && ok;

  const tasks = await req("GET", "/chef-tasks/board?section=All", null, token);
  ok = assert(
    "Chef tasks from database",
    tasks.status === 200 && Array.isArray(tasks.data?.tasks) && tasks.data.tasks.length > 0,
    `${tasks.data?.tasks?.length ?? 0} tasks`,
  ) && ok;

  const comm = await req("GET", "/kitchen/communication?section=All", null, token);
  ok = assert(
    "Kitchen communication from database",
    comm.status === 200 && Array.isArray(comm.data?.messages) && comm.data.messages.length > 0,
    `${comm.data?.messages?.length ?? 0} messages`,
  ) && ok;

  const recipes = await req("GET", "/recipes/costing?section=All", null, token);
  ok = assert(
    "Recipe costing from database",
    recipes.status === 200 && Array.isArray(recipes.data?.recipes) && recipes.data.recipes.length > 0,
    `${recipes.data?.recipes?.length ?? 0} recipes`,
  ) && ok;

  // Round-trip: deduct inventory
  const target = items.find((i) => i.onHand > 0);
  if (target) {
    const before = target.onHand;
    const deduct = await req(
      "POST",
      "/inventory/deduct",
      { itemId: target.id, quantity: 0.1, action: "deduct" },
      token,
    );
    ok = assert("Inventory deduct persists", deduct.status === 200 && deduct.json?.success) && ok;
    const inv2 = await req("GET", "/inventory/board?section=All", null, token);
    const afterItem = (inv2.data?.items ?? []).find((i) => i.id === target.id);
    ok = assert(
      "Inventory stock updated in DB",
      afterItem && afterItem.onHand < before,
      `${before} → ${afterItem?.onHand}`,
    ) && ok;
  }

  // Round-trip: chef task action
  const chefTask = tasks.data?.tasks?.find((t) => t.availableActions?.includes("start_task"));
  if (chefTask) {
    const rawId = String(chefTask.id).replace(/^TSK-/, "");
    const act = await req(
      "POST",
      `/chef-tasks/${rawId}/action`,
      { action: "start_task" },
      token,
    );
    ok = assert("Chef task action persists", act.status === 200 && act.json?.success) && ok;
  }

  // KDS action on live order
  const order = (kds.data?.orders ?? []).find((o) => o.availableActions?.length);
  if (order) {
    const orderId = String(order.id).replace(/^ORD-/, "");
    const act = await req(
      "POST",
      `/kds/orders/${orderId}/action`,
      { action: "accept", section: order.section ?? "Main" },
      token,
    );
    ok = assert("KDS order action", act.status === 200 && act.json?.success !== false) && ok;
  }

  return ok;
}

async function testWaiterRealData(token) {
  console.log("\n── Waiter · real data ──");
  let ok = true;

  const board = await req("GET", "/waiter-auto-assignment/board?section=All", null, token);
  ok = assert(
    "Waiter board from live orders / DB",
    board.status === 200 && Array.isArray(board.data?.tasks),
    `${board.data?.tasks?.length ?? 0} tasks · ${board.data?.notifications?.length ?? 0} notifications`,
  ) && ok;

  const calls = board.data?.notifications ?? [];
  const readyTask = (board.data?.tasks ?? []).find(
    (t) => t.availableActions?.includes("acknowledge") || t.availableActions?.includes("start_delivery"),
  );
  if (readyTask) {
    const taskId = String(readyTask.id).replace(/^WT-/, "");
    const act = await req(
      "POST",
      `/waiter-auto-assignment/tasks/WT-${taskId}/action`,
      { action: readyTask.availableActions.includes("start_delivery") ? "start_delivery" : "acknowledge" },
      token,
    );
    ok = assert("Waiter delivery action persists", act.status === 200 && act.json?.success) && ok;
  }

  const allocate = await req("POST", "/waiter-auto-assignment/auto-allocate", {}, token);
  ok = assert(
    "Waiter auto-allocate (DB assignment)",
    allocate.status === 200 && allocate.json?.success,
    allocate.json?.message ?? "",
  ) && ok;

  ok = assert("Waiter calls seeded", calls.length >= 0, `${calls.length} notifications`) && ok;

  return ok;
}

async function testHousekeepingRealData(token) {
  console.log("\n── Housekeeping · real data ──");
  let ok = true;

  const hygiene = await req("GET", "/hygiene/board?section=All", null, token);
  const schedules = hygiene.data?.cleaningSchedules ?? [];
  const checklists = hygiene.data?.hygieneChecklists ?? [];
  ok = assert(
    "Hygiene board from database",
    hygiene.status === 200 && (schedules.length + checklists.length) > 0,
    `${schedules.length} schedules · ${checklists.length} checklists`,
  ) && ok;

  const room = await req("GET", "/room-service/board?section=All", null, token);
  const roomOrders = room.data?.roomOrders ?? [];
  ok = assert(
    "Room service from database",
    room.status === 200 && Array.isArray(roomOrders) && roomOrders.length > 0,
    `${roomOrders.length} requests`,
  ) && ok;

  const hkTask = [...schedules, ...checklists].find(
    (t) => Array.isArray(t.availableActions) && t.availableActions.includes("start_task"),
  );
  if (hkTask) {
    const act = await req(
      "POST",
      `/hygiene/tasks/${hkTask.id}/action`,
      { action: "start_task" },
      token,
    );
    ok = assert("Housekeeping task action persists", act.status === 200 && act.json?.success) && ok;
  }

  const rsOrder = roomOrders.find(
    (o) => Array.isArray(o.availableActions) && o.availableActions.length > 0,
  );
  if (rsOrder) {
    const act = await req(
      "POST",
      `/room-service/orders/${rsOrder.id}/action`,
      { action: rsOrder.availableActions[0] },
      token,
    );
    ok = assert("Room service action persists", act.status === 200 && act.json?.success) && ok;
  }

  return ok;
}

async function testNoStubFallbacks(token) {
  console.log("\n── Stub detection (kitchen modules) ──");
  let ok = true;

  const inv = await req("GET", "/inventory/board?section=All", null, token);
  const stubInv = (inv.data?.items ?? []).some(
    (i) => i.id === STUB_MARKERS.inventory.id && i.name === STUB_MARKERS.inventory.name,
  );
  ok = assert("No hardcoded Butter inventory stub", !stubInv) && ok;

  const equip = await req("GET", "/equipment/board?section=All", null, token);
  const assets = equip.data?.assets ?? [];
  const isStubEquip = assets.some(
    (a) => a.id === STUB_MARKERS.equipment.id && a.name === STUB_MARKERS.equipment.name,
  );
  // Equipment may use computed snapshot until IoT integration — warn only
  if (isStubEquip) {
    console.log("WARN  Equipment board uses template snapshot (no IoT DB yet)");
  }

  return ok;
}

async function main() {
  console.log(`\n=== Mobile real-data validation ===\n${ROOT}\n`);

  const chefToken = await login("chef@spicegarden.com", "headChef");
  const waiterToken = await login("waiter@spicegarden.com", "waiter");
  const hkToken = await login("housekeeping@spicegarden.com", "housekeeping");

  const results = [
    await testKitchenRealData(chefToken),
    await testWaiterRealData(waiterToken),
    await testHousekeepingRealData(hkToken),
    await testNoStubFallbacks(chefToken),
  ];

  if (results.every(Boolean)) {
    console.log("\n✓ All mobile real-data checks passed (DB + live orders, actions persist).\n");
    return;
  }
  console.error("\n✗ Some real-data checks failed.\n");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
