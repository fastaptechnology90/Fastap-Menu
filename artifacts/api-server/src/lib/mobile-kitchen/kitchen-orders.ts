import { eq, and, desc, inArray } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { autoAssignWaiterToOrder } from "../staff-auto-assignment.js";
import { broadcastEvent, broadcastOrderEvent } from "../sse.js";

export const KITCHEN_SECTIONS = ["Main", "Tandoor", "Chinese", "Beverage", "Bar", "Dessert", "Bakery", "Floor"];

const ACTIVE_DB = ["pending", "confirmed", "preparing", "ready", "serving", "delayed", "billing"];
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
    case "serving":
    case "delivered":
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
  const itemNames = items.map(i => `${i.quantity ?? 1}x ${i.name ?? "Item"}`);
  const vip = Boolean(meta.vip ?? tracking.vip);
  const allergy = items.some(i => Boolean(i.allergy) || /allergy|nut|gluten/i.test(String(i.notes ?? "")));
  const kotNumber = `KOT-${row.id}`;
  const location = row.type === "room_service"
    ? (row.tableName || (meta.roomNumber ? `Room ${meta.roomNumber}` : "Room Service"))
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
    addOns: [] as string[],
    modifiers: items.flatMap(i => (Array.isArray(i.addons) ? i.addons.map((a: any) => String(a.name ?? a)) : [])),
    cookingNotes: items.map(i => i.notes).filter(Boolean).map(String),
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
    waiterName: row.waiterName ?? undefined,
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
    case "on_hold": return ["release", "reject"];
    default: return [];
  }
}

export async function fetchKitchenOrders(restaurantId: number) {
  const rows = await db.select().from(ordersTable)
    .where(and(
      eq(ordersTable.restaurantId, restaurantId),
      inArray(ordersTable.status, ACTIVE_DB),
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
      .filter(o => ["new", "accepted", "preparing", "delayed", "ready"].includes(o.status))
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

export async function getDashboard(restaurantId: number, section = "All") {
  const orders = await fetchKitchenOrders(restaurantId);
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

export async function applyKdsAction(restaurantId: number, orderIdRaw: string, action: string) {
  const orderId = parseInt(orderIdRaw.replace(/^ORD-/, ""), 10);
  if (!Number.isFinite(orderId)) throw new Error("ORDER_NOT_FOUND");

  const [existing] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)))
    .limit(1);
  if (!existing) throw new Error("ORDER_NOT_FOUND");

  const meta = (existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>;
  const mobileStatus = dbToMobileStatus(existing.status, meta);
  const mapped = mobileToDbStatus(action, mobileStatus);
  const nextMeta = { ...meta, ...(mapped.meta ?? {}) };
  if (mapped.meta?.kitchenHold === false) delete nextMeta.kitchenHold;
  if (mapped.meta?.reFire) nextMeta.reFire = true;

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

