import { eq, and, desc, inArray, gte } from "drizzle-orm";
import { db, ordersTable, roomServiceRequestsTable, housekeepingTasksTable, tablesMapTable } from "@workspace/db";
import { autoAssignWaiterToOrder } from "../staff-auto-assignment.js";
import { broadcastEvent, broadcastOrderEvent } from "../sse.js";

export const KITCHEN_SECTIONS = ["Main", "Tandoor", "Chinese", "Beverage", "Bar", "Dessert", "Bakery", "Floor"];

const ACTIVE_DB = ["pending", "confirmed", "preparing", "ready", "serving", "delayed", "billing"];
// Orders the apps display: the active ones plus recently "completed" (delivered),
// so the waiter keeps a "Delivered" record. Everything auto-clears from both apps
// after 24h (a display window — the rows stay in the DB, just stop showing).
const DISPLAY_DB = [...ACTIVE_DB, "completed"];
const DISPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const KITCHEN_ACTIVE = new Set(["new", "accepted", "preparing", "delayed", "ready", "re_fire", "on_hold"]);

function parseItems(raw: unknown): any[] {
  return Array.isArray(raw) ? raw : [];
}

function dbToMobileStatus(status: string, meta: Record<string, unknown>): string {
  if (meta.kitchenHold) return "on_hold";
  if (meta.reFire) return "re_fire";
  switch (status.toLowerCase()) {
    case "pending": return "new";
    case "confirmed": return "accepted";
    case "preparing": return "preparing";
    case "delayed": return "delayed";
    case "ready": return "ready";
    case "serving": return "serving";
    case "delivered": return "served";
    case "billing": return "ready";
    case "completed": return "served";
    case "cancelled": return "rejected";
    default: return "accepted";
  }
}

function mobileToDbStatus(action: string, current: string): { status: string; meta?: Record<string, unknown> } {
  switch (action) {
    case "accept": return { status: "confirmed" };
    case "prepare": return { status: "preparing" };
    case "ready": return { status: "ready" };
    case "delay": return { status: "delayed" };
    case "reject":
    case "cancel": return { status: "cancelled" };
    case "hold": return { status: current, meta: { kitchenHold: true } };
    case "release": return { status: "preparing", meta: { kitchenHold: false } };
    case "refire": return { status: "preparing", meta: { reFire: true } };
    // Waiter delivery flow: pick up a ready order (on the way), then deliver it.
    case "serve": return { status: "serving" };
    case "deliver": return { status: "completed" };
    default: return { status: current };
  }
}

function timerSeconds(createdAt: Date, status: string): number {
  if (!KITCHEN_ACTIVE.has(status)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 1000));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function progressFor(status: string, seconds: number): number {
  const base = switchProgress(status);
  return Math.min(0.98, base + (seconds / 3600));
}

function switchProgress(status: string): number {
  switch (status) {
    case "new": return 0.08;
    case "accepted": return 0.2;
    case "preparing": return 0.55;
    case "delayed": return 0.7;
    case "ready": return 0.95;
    default: return 0.1;
  }
}

function inferSection(items: any[]): string {
  const text = items.map(i => `${i.name ?? ""} ${i.category ?? ""}`).join(" ").toLowerCase();
  if (/tandoor|naan|roti|kebab/.test(text)) return "Tandoor";
  if (/noodle|wok|dim|chow|manchurian/.test(text)) return "Chinese";
  if (/coffee|tea|shake|mocktail|cocktail|beer|wine|juice|lassi/.test(text)) return "Beverage";
  if (/bar |whiskey|vodka|rum|gin/.test(text)) return "Bar";
  if (/cake|dessert|ice cream|pastry|brownie/.test(text)) return "Dessert";
  if (/bread|bun|croissant|muffin/.test(text)) return "Bakery";
  return "Main";
}

export type MappedKitchenOrder = ReturnType<typeof mapOrderRow>;

function mapOrderRow(row: typeof ordersTable.$inferSelect) {
  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  const tracking = (meta.tracking && typeof meta.tracking === "object" ? meta.tracking : {}) as Record<string, unknown>;
  const items = parseItems(row.items);
  const section = typeof meta.kitchenSection === "string" && meta.kitchenSection
    ? meta.kitchenSection
    : inferSection(items);
  const status = dbToMobileStatus(row.status, meta);
  const seconds = timerSeconds(row.createdAt, status);
  const itemNames = items.map(i => {
    const base = `${i.quantity ?? 1}x ${i.name ?? "Item"}`;
    return i.variant ? `${base} (${i.variant})` : base;
  });
  // Per-dish add-ons (paid extras), modifiers (removals / preferences like "No chili") and
  // notes — each tagged with its dish so the line cook knows exactly what to do to which item.
  const orderAddOns = items.flatMap((i: any) =>
    Array.isArray(i.addons) ? i.addons.map((a: any) => `${i.name ?? "Item"}: + ${String(a.name ?? a)}`) : []);
  const orderModifiers = items.flatMap((i: any) =>
    Array.isArray(i.customizations) ? i.customizations.map((c: any) => `${i.name ?? "Item"}: ${String(c)}`) : []);
  const orderNotes = [
    ...items.filter((i: any) => i.notes).map((i: any) => `${i.name ?? "Item"}: ${String(i.notes)}`),
    ...(row.notes ? [String(row.notes)] : []),
  ];
  const vip = Boolean(meta.vip ?? tracking.vip);
  const allergy = items.some(i => Boolean(i.allergy) || /allergy|nut|gluten/i.test(String(i.notes ?? "")));
  const kotNumber = `KOT-${row.id}`;
  // A room order isn't always tagged type "room_service" — detect it by a room
  // number or a "Room …" table name so the label reads "Room 501", not
  // "Table Room 501", and so it routes to housekeeping rather than a waiter.
  const isRoom = row.type === "room_service"
    || meta.roomNumber != null
    || /^\s*room\b/i.test(String(row.tableName ?? ""));
  const location = isRoom
    ? (meta.roomNumber ? `Room ${meta.roomNumber}` : (row.tableName || "Room Service"))
    : row.tableName
      ? `Table ${row.tableName}`
      : row.type === "delivery"
        ? "Delivery"
        : "Dine-in";
  const priority = vip ? "vip" : status === "delayed" ? "express" : "normal";

  return {
    id: `ORD-${row.id}`,
    orderId: `ORD-${row.id}`,
    kotNumber,
    title: kotNumber,
    location,
    section,
    category: section,
    assignedChef: String(tracking.chefName ?? "Kitchen Team"),
    guestType: vip ? "VIP" : "Regular",
    deliveryType: row.type === "delivery" ? "Delivery" : row.type === "takeaway" ? "Takeaway" : "Dine-in",
    items: itemNames,
    addOns: orderAddOns,
    modifiers: orderModifiers,
    cookingNotes: orderNotes,
    status,
    priority,
    timerSeconds: seconds,
    timer: formatDuration(seconds),
    progress: progressFor(status, seconds),
    sortOrder: row.id,
    vip,
    allergy,
    reFireRequested: Boolean(meta.reFire),
    tableNumber: row.tableName ?? undefined,
    roomNumber: meta.roomNumber ? String(meta.roomNumber) : undefined,
    isRoom,
    waiterName: row.waiterName ?? undefined,
    // Bill + payment so the waiter can collect and mark it paid.
    total: Number(row.total ?? 0),
    paymentStatus: String(row.paymentStatus ?? "pending"),
    paymentMethod: row.paymentMethod ?? undefined,
    statusLabel: status === "preparing" && vip ? "VIP" : undefined,
    lineItems: itemNames.map(name => ({ name, status: "active", modifiable: true })),
    held: status === "on_hold",
    availableActions: availableActions(status),
  };
}

function availableActions(status: string): string[] {
  switch (status) {
    case "new": return ["accept", "reject", "cancel", "hold", "reassign"];
    case "accepted": return ["prepare", "hold", "delay", "reject", "cancel", "reassign"];
    case "preparing": return ["ready", "delay", "hold", "refire", "cancel", "reassign"];
    case "delayed": return ["prepare", "ready", "hold", "refire", "cancel"];
    case "re_fire": return ["ready", "delay", "refire", "cancel"];
    // Waiter delivery actions surfaced once the kitchen is done.
    case "ready": return ["serve"];
    case "serving": return ["deliver"];
    case "on_hold": return ["release", "reject"];
    default: return [];
  }
}

export async function fetchKitchenOrders(restaurantId: number) {
  const rows = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.restaurantId, restaurantId),
      inArray(ordersTable.status, DISPLAY_DB),
      gte(ordersTable.createdAt, new Date(Date.now() - DISPLAY_WINDOW_MS)),
    ))
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  return rows.map(mapOrderRow);
}

function filterSection(orders: ReturnType<typeof mapOrderRow>[], section: string) {
  if (!section || section === "All") return orders;
  return orders.filter(o => o.section === section);
}

function buildDashboard(section: string, orders: ReturnType<typeof mapOrderRow>[]) {
  const filtered = filterSection(orders, section);
  const active = filtered.filter(o => KITCHEN_ACTIVE.has(o.status)).length;
  const delayed = filtered.filter(o => o.status === "delayed").length;
  const vip = filtered.filter(o => o.vip).length;
  const priority = filtered.filter(o => o.priority !== "normal").length;
  const pending = filtered.filter(o => o.status === "new" || o.status === "accepted").length;
  const completed = filtered.filter(o => o.status === "ready" || o.status === "served").length;
  const rejected = filtered.filter(o => o.status === "rejected").length;
  const rushCount = filtered.filter(o => o.status === "delayed" || o.priority === "express" || o.timerSeconds > 600).length;
  const avgSeconds = filtered.length
    ? Math.round(filtered.reduce((s, o) => s + o.timerSeconds, 0) / filtered.length)
    : 780;
  const delayRatio = filtered.length ? Math.round((delayed / filtered.length) * 100) : 0;
  const efficiency = Math.max(60, Math.min(99, 100 - delayRatio));

  return {
    section,
    lastSyncedAt: new Date().toISOString(),
    sections: KITCHEN_SECTIONS,
    widgets: [
      { key: "activeOrders", label: "Active orders", value: String(active), detail: active > 8 ? "Rush hour" : "Normal", tone: active > 8 ? "danger" : "primary" },
      { key: "delayedOrders", label: "Delayed orders", value: String(delayed), detail: delayed > 0 ? "Action needed" : "On track", tone: "warning" },
      { key: "vipOrders", label: "VIP orders", value: String(vip), detail: vip > 0 ? "Priority lane" : "Clear", tone: "premium" },
      { key: "priorityOrders", label: "Priority orders", value: String(priority), detail: "Express + VIP", tone: "info" },
      { key: "pendingKots", label: "Pending KOTs", value: String(pending), detail: "Awaiting prep", tone: "info" },
      { key: "completedOrders", label: "Completed orders", value: String(completed), detail: "Shift total", tone: "primary" },
      { key: "rejectedOrders", label: "Rejected orders", value: String(rejected), detail: rejected > 0 ? "Review QC" : "None", tone: "danger" },
      { key: "rushAlerts", label: "Rush alerts", value: String(rushCount), detail: rushCount > 0 ? "Action needed" : "Stable", tone: "danger" },
    ],
    metrics: [
      { key: "kitchenEfficiency", label: "Kitchen efficiency", value: `${efficiency}%`, detail: "Live", tone: "primary" },
      { key: "avgPrepTime", label: "Average preparation time", value: formatDuration(avgSeconds), detail: "Live queue", tone: "info" },
      { key: "delayRatio", label: "Delay ratio", value: `${delayRatio}%`, detail: delayed > 2 ? "Above target" : "On target", tone: "warning" },
      { key: "orderBacklog", label: "Order backlog", value: String(pending + active), detail: "Queue depth", tone: "danger" },
    ],
    sectionWorkload: KITCHEN_SECTIONS.map(name => {
      const count = filtered.filter(o => o.section === name && KITCHEN_ACTIVE.has(o.status)).length;
      return { section: name, activeOrders: count, load: Math.min(1, count / 6), staffAssigned: count > 3 ? 3 : count > 0 ? 2 : 1 };
    }),
    rushAlerts: filtered.filter(o => o.status === "delayed" || o.vip).slice(0, 4).map(o => ({
      id: `ALERT-${o.id}`,
      title: o.status === "delayed" ? `${o.kotNumber} delayed` : `VIP ${o.kotNumber}`,
      message: `${o.section} · ${o.location}`,
      severity: o.status === "delayed" ? "critical" : "vip",
      timestamp: new Date().toISOString(),
    })),
    orders: filtered
      // Keep "serving" (out for delivery) and "served" (delivered) so the waiter's
      // order stays visible through Start Delivery -> Delivered and keeps a
      // Delivered record afterwards (until the 24h window drops it).
      .filter(o => ["new", "accepted", "preparing", "delayed", "ready", "serving", "served"].includes(o.status))
      .map(o => ({ ...o, statusLabel: o.statusLabel ?? o.status })),
  };
}

function buildKds(section: string, view: string, filter: string, orders: ReturnType<typeof mapOrderRow>[]) {
  let filtered = filterSection(orders, section);
  if (filter === "vip") filtered = filtered.filter(o => o.vip);
  if (filter === "delayed") filtered = filtered.filter(o => o.status === "delayed");
  if (filter === "priority") filtered = filtered.filter(o => o.priority !== "normal");
  filtered = filtered.filter(o => KITCHEN_ACTIVE.has(o.status));

  const stats = {
    total: filtered.length,
    delayed: filtered.filter(o => o.status === "delayed").length,
    vip: filtered.filter(o => o.vip).length,
    priority: filtered.filter(o => o.priority !== "normal").length,
  };

  if (view === "grouped") {
    const groups = KITCHEN_SECTIONS
      .map(group => ({
        group,
        orders: filtered.filter(o => o.section === group),
      }))
      .filter(g => g.orders.length > 0);
    return {
      section,
      view,
      filter,
      lastSyncedAt: new Date().toISOString(),
      orders: groups,
      stats,
    };
  }

  return {
    section,
    view,
    filter,
    lastSyncedAt: new Date().toISOString(),
    orders: filtered,
    stats,
  };
}

function buildProcessing(section: string, orders: ReturnType<typeof mapOrderRow>[]) {
  const filtered = filterSection(orders, section).filter(o => KITCHEN_ACTIVE.has(o.status));
  return {
    section,
    lastSyncedAt: new Date().toISOString(),
    orders: filtered.map(o => ({
      ...o,
      lineItems: o.lineItems,
      held: o.held,
      availableActions: o.availableActions,
    })),
    stats: {
      total: filtered.length,
      held: filtered.filter(o => o.held).length,
      vip: filtered.filter(o => o.vip).length,
      rush: filtered.filter(o => o.status === "delayed").length,
      batchGroups: 0,
    },
    smartProcessing: {
      autoQueueSorting: true,
      aiPriorityHandling: true,
      vipPrioritization: true,
      rushHourOptimization: filtered.some(o => o.status === "delayed"),
      batchCookingManagement: true,
      smartCookingSequence: true,
    },
    batchCooking: [],
    cookingSequence: filtered.slice(0, 6).map(o => ({
      orderId: o.id,
      kotNumber: o.kotNumber,
      step: o.status === "new" ? "Accept" : o.status === "accepted" ? "Start prep" : "Finish",
      etaMinutes: Math.max(1, Math.ceil((900 - o.timerSeconds) / 60)),
    })),
    sections: KITCHEN_SECTIONS,
  };
}

function buildLiveAlerts(section: string, orders: ReturnType<typeof mapOrderRow>[]) {
  const filtered = filterSection(orders, section);
  const alerts = filtered
    .filter(o => o.status === "delayed" || o.vip || o.allergy)
    .slice(0, 12)
    .map(o => ({
      id: `ALERT-${o.id}`,
      alertType: o.status === "delayed" ? "delay" : o.vip ? "vip" : "allergy",
      title: o.status === "delayed" ? `${o.kotNumber} delayed` : o.vip ? `VIP ${o.kotNumber}` : `Allergy alert ${o.kotNumber}`,
      section: o.section,
      severity: o.status === "delayed" ? "critical" : o.vip ? "high" : "medium",
      message: `${o.location} · ${o.items.slice(0, 2).join(", ")}`,
      triggeredAt: new Date().toISOString(),
      status: "active",
      availableActions: ["acknowledge_alert", "escalate_alert", "resolve_alert", "snooze_alert"],
    }));

  return {
    section,
    lastSyncedAt: new Date().toISOString(),
    alerts,
    stats: {
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === "critical").length,
      delayAlerts: alerts.filter(a => a.alertType === "delay").length,
      vipAlerts: alerts.filter(a => a.alertType === "vip").length,
      emergencyAlerts: 0,
      resolvedToday: 0,
    },
    alertFeatures: {
      delayAlerts: alerts.some(a => a.alertType === "delay"),
      vipAlerts: alerts.some(a => a.alertType === "vip"),
      emergencyAlerts: false,
      lowStockAlerts: false,
      equipmentAlerts: false,
      hygieneAlerts: false,
    },
    sections: KITCHEN_SECTIONS,
  };
}

// ─── Room-service & housekeeping requests (non-food) ───────────────────────
// A guest in a room can ask for non-food things (towels, cleaning, laundry).
// Those live in their own tables; we surface the ones assigned to the current
// housekeeping staff as "deliveries" in their app, carrying the guest's message.
function requestMobileStatus(status: string): string {
  switch (status) {
    case "pending":
    case "accepted": return "ready";
    case "in_progress": return "serving";
    case "completed": return "served";
    default: return "ready";
  }
}

function roomRequestOrder(p: {
  id: string; roomNumber: string; itemNames: string[]; message?: string | null;
  statusMobile: string; assignedTo?: string | null; section: string; createdAt: Date;
}) {
  const status = p.statusMobile;
  const location = `Room ${p.roomNumber}`;
  const seconds = KITCHEN_ACTIVE.has(status)
    ? Math.max(0, Math.floor((Date.now() - p.createdAt.getTime()) / 1000))
    : 0;
  return {
    id: p.id,
    orderId: p.id,
    kotNumber: location,
    title: location,
    location,
    section: p.section,
    category: p.section,
    assignedChef: "Room service",
    guestType: "Room",
    deliveryType: "Room service",
    items: p.itemNames,
    addOns: [] as string[],
    modifiers: [] as string[],
    cookingNotes: p.message ? [p.message] : [],
    status,
    priority: "normal",
    timerSeconds: seconds,
    timer: formatDuration(seconds),
    progress: progressFor(status, seconds),
    sortOrder: 0,
    vip: false,
    allergy: false,
    reFireRequested: false,
    tableNumber: undefined as string | undefined,
    roomNumber: String(p.roomNumber),
    isRoom: true,
    waiterName: p.assignedTo ?? undefined,
    statusLabel: undefined as string | undefined,
    lineItems: p.itemNames.map(name => ({ name, status: "active", modifiable: false })),
    held: false,
    availableActions: status === "ready" ? ["serve"] : status === "serving" ? ["deliver"] : [],
  };
}

async function fetchRoomRequests(restaurantId: number, assignedTo?: string | null) {
  if (!assignedTo) return [];
  const since = new Date(Date.now() - DISPLAY_WINDOW_MS);
  const [rsr, hkt] = await Promise.all([
    db.select().from(roomServiceRequestsTable).where(and(
      eq(roomServiceRequestsTable.restaurantId, restaurantId),
      eq(roomServiceRequestsTable.assignedTo, assignedTo),
      inArray(roomServiceRequestsTable.status, ["pending", "accepted", "in_progress", "completed"]),
      gte(roomServiceRequestsTable.createdAt, since),
    )).orderBy(desc(roomServiceRequestsTable.createdAt)).limit(50),
    db.select().from(housekeepingTasksTable).where(and(
      eq(housekeepingTasksTable.restaurantId, restaurantId),
      eq(housekeepingTasksTable.assignedTo, assignedTo),
      inArray(housekeepingTasksTable.status, ["pending", "in_progress", "completed"]),
      gte(housekeepingTasksTable.createdAt, since),
    )).orderBy(desc(housekeepingTasksTable.createdAt)).limit(50),
  ]);
  const rsrOrders = rsr.map(r => {
    const items = Array.isArray(r.items) ? (r.items as any[]) : [];
    const itemNames = items.length
      ? items.map(i => typeof i === "string" ? i : `${i.quantity ?? 1}x ${i.name ?? "Item"}`)
      : [`${r.type ?? "Room service"} request`];
    return roomRequestOrder({
      id: `RSR-${r.id}`, roomNumber: r.roomNumber, itemNames, message: r.notes,
      statusMobile: requestMobileStatus(r.status), assignedTo: r.assignedTo,
      section: "Room service", createdAt: r.createdAt,
    });
  });
  const hktOrders = hkt.map(t => roomRequestOrder({
    id: `HKT-${t.id}`, roomNumber: t.roomNumber ?? t.location, itemNames: [t.title],
    message: t.notes ?? t.description, statusMobile: requestMobileStatus(t.status),
    assignedTo: t.assignedTo, section: "Housekeeping", createdAt: t.createdAt,
  }));
  return [...rsrOrders, ...hktOrders];
}

export async function getDashboard(
  restaurantId: number,
  section = "All",
  assignee?: { role?: string; name?: string },
) {
  let orders = await fetchKitchenOrders(restaurantId);
  // Housekeeping also sees their assigned non-food room requests (with message).
  if (assignee?.role === "housekeeping" && assignee.name) {
    orders = [...orders, ...await fetchRoomRequests(restaurantId, assignee.name)];
  }
  return buildDashboard(section, orders);
}

export async function getKds(restaurantId: number, section = "All", view = "queue", filter = "all") {
  const orders = await fetchKitchenOrders(restaurantId);
  return buildKds(section, view, filter, orders);
}

export async function getProcessing(restaurantId: number, section = "All") {
  const orders = await fetchKitchenOrders(restaurantId);
  return buildProcessing(section, orders);
}

export async function getLiveAlerts(restaurantId: number, section = "All") {
  const orders = await fetchKitchenOrders(restaurantId);
  return buildLiveAlerts(section, orders);
}

// Housekeeping acting on a non-food room request: serve = start (in progress),
// deliver = completed. Mirrors the delivery flow but on the request tables.
async function applyRoomRequestAction(restaurantId: number, orderIdRaw: string, action: string) {
  const isRsr = orderIdRaw.startsWith("RSR-");
  const id = parseInt(orderIdRaw.replace(/^(RSR|HKT)-/, ""), 10);
  if (!Number.isFinite(id)) throw new Error("ORDER_NOT_FOUND");
  const nextStatus = action === "deliver" ? "completed" : action === "serve" ? "in_progress" : null;
  const patch: Record<string, unknown> = {};
  if (nextStatus) {
    patch.status = nextStatus;
    if (nextStatus === "completed") patch.completedAt = new Date();
  }

  if (isRsr) {
    const [existing] = await db.select().from(roomServiceRequestsTable)
      .where(and(eq(roomServiceRequestsTable.id, id), eq(roomServiceRequestsTable.restaurantId, restaurantId))).limit(1);
    if (!existing) throw new Error("ORDER_NOT_FOUND");
    if (nextStatus) await db.update(roomServiceRequestsTable).set(patch).where(eq(roomServiceRequestsTable.id, id));
    const [u] = await db.select().from(roomServiceRequestsTable).where(eq(roomServiceRequestsTable.id, id)).limit(1);
    const items = Array.isArray(u.items) ? (u.items as any[]) : [];
    const itemNames = items.length
      ? items.map(i => typeof i === "string" ? i : `${i.quantity ?? 1}x ${i.name ?? "Item"}`)
      : [`${u.type ?? "Room service"} request`];
    return roomRequestOrder({ id: orderIdRaw, roomNumber: u.roomNumber, itemNames, message: u.notes, statusMobile: requestMobileStatus(u.status), assignedTo: u.assignedTo, section: "Room service", createdAt: u.createdAt });
  }
  const [existing] = await db.select().from(housekeepingTasksTable)
    .where(and(eq(housekeepingTasksTable.id, id), eq(housekeepingTasksTable.restaurantId, restaurantId))).limit(1);
  if (!existing) throw new Error("ORDER_NOT_FOUND");
  if (nextStatus) await db.update(housekeepingTasksTable).set(patch).where(eq(housekeepingTasksTable.id, id));
  const [u] = await db.select().from(housekeepingTasksTable).where(eq(housekeepingTasksTable.id, id)).limit(1);
  return roomRequestOrder({ id: orderIdRaw, roomNumber: u.roomNumber ?? u.location, itemNames: [u.title], message: u.notes ?? u.description, statusMobile: requestMobileStatus(u.status), assignedTo: u.assignedTo, section: "Housekeeping", createdAt: u.createdAt });
}

export async function applyKdsAction(restaurantId: number, orderIdRaw: string, action: string) {
  if (orderIdRaw.startsWith("RSR-") || orderIdRaw.startsWith("HKT-")) {
    return applyRoomRequestAction(restaurantId, orderIdRaw, action);
  }
  const orderId = parseInt(orderIdRaw.replace(/^ORD-/, ""), 10);
  if (!Number.isFinite(orderId)) throw new Error("ORDER_NOT_FOUND");

  const [existing] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)))
    .limit(1);
  if (!existing) throw new Error("ORDER_NOT_FOUND");

  // Payment collected by the waiter (cash / UPI / card at the table): mark the
  // bill paid with the ACTUAL method the waiter chose ("collect_cash" etc.), so
  // the owner's live-order page shows the real method — not the order's default.
  if (action === "collect" || action.startsWith("collect_")) {
    const method = action.includes("_") ? action.split("_")[1] : "cash";
    const [paid] = await db.update(ordersTable).set({
      paymentStatus: "paid",
      paymentMethod: method,
    }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();
    broadcastEvent("order_paid", { id: orderId, restaurantId, tableName: existing.tableName });
    broadcastOrderEvent(orderId, "order_paid", { id: orderId, paymentStatus: "paid" });
    return mapOrderRow(paid);
  }

  // Waiter asks the guest to pay: flag the bill as requested and nudge the guest.
  if (action === "request_payment") {
    const rMeta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
    const [flagged] = await db.update(ordersTable).set({
      metadata: { ...rMeta, billRequested: true },
    }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();
    broadcastEvent("bill_requested", { id: orderId, restaurantId, tableName: existing.tableName });
    broadcastOrderEvent(orderId, "bill_requested", { id: orderId });
    return mapOrderRow(flagged);
  }

  // Guest left: close the table's open orders and free the table for the next guest.
  if (action === "clear_table") {
    await db.update(ordersTable).set({ status: "completed" }).where(and(
      eq(ordersTable.restaurantId, restaurantId),
      existing.tableId
        ? eq(ordersTable.tableId, existing.tableId)
        : eq(ordersTable.tableName, existing.tableName),
      inArray(ordersTable.status, ACTIVE_DB),
    ));
    if (existing.tableId) {
      await db.update(tablesMapTable).set({ status: "free", currentGuestCount: 0 })
        .where(and(eq(tablesMapTable.id, existing.tableId), eq(tablesMapTable.restaurantId, restaurantId)));
    }
    broadcastEvent("table_cleared", { restaurantId, tableName: existing.tableName });
    const [done] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).limit(1);
    return mapOrderRow(done);
  }

  const meta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  const mobileStatus = dbToMobileStatus(existing.status, meta);
  const mapped = mobileToDbStatus(action, mobileStatus);
  const nextMeta = { ...meta, ...(mapped.meta ?? {}) };
  if (mapped.meta?.kitchenHold === false) delete nextMeta.kitchenHold;
  if (mapped.meta?.reFire) nextMeta.reFire = true;
  // Reflect the waiter's delivery step in the guest-facing tracking snapshot.
  if (action === "serve" || action === "deliver") {
    const tracking = (nextMeta.tracking && typeof nextMeta.tracking === "object"
      ? nextMeta.tracking
      : {}) as Record<string, unknown>;
    nextMeta.tracking = {
      ...tracking,
      waiterStatus: action === "serve" ? "on_the_way" : "delivered",
    };
  }

  let [updated] = await db.update(ordersTable).set({
    status: mapped.status,
    metadata: nextMeta,
  }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();

  if (!updated) throw new Error("ORDER_NOT_FOUND");

  // Mirror the web-panel behaviour in orders.ts: once the kitchen marks an order
  // ready, hand it to a waiter and notify them (see BUG.md #3).
  if (mapped.status === "ready" && !updated.waiterName) {
    const assigned = await autoAssignWaiterToOrder(restaurantId, orderId);
    if (assigned) updated = assigned;
  }

  broadcastEvent("order_status", {
    id: updated.id,
    tableName: updated.tableName,
    status: updated.status,
    restaurantId,
  });
  broadcastOrderEvent(updated.id, "order_status", {
    id: updated.id,
    status: updated.status,
    tableName: updated.tableName,
  });

  return mapOrderRow(updated);
}

export async function reassignKdsSection(restaurantId: number, orderIdRaw: string, targetSection: string) {
  const orderId = parseInt(orderIdRaw.replace(/^ORD-/, ""), 10);
  if (!Number.isFinite(orderId)) throw new Error("ORDER_NOT_FOUND");
  if (!KITCHEN_SECTIONS.includes(targetSection)) throw new Error("INVALID_SECTION");

  const [existing] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)))
    .limit(1);
  if (!existing) throw new Error("ORDER_NOT_FOUND");

  const meta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  const [updated] = await db.update(ordersTable)
    .set({ metadata: { ...meta, kitchenSection: targetSection } })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)))
    .returning();
  if (!updated) throw new Error("ORDER_NOT_FOUND");

  broadcastEvent("order_status", {
    id: updated.id,
    tableName: updated.tableName,
    status: updated.status,
    restaurantId,
  });

  return mapOrderRow(updated);
}

