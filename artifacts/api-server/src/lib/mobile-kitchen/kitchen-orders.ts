import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { db, ordersTable, roomServiceRequestsTable, housekeepingTasksTable, tablesMapTable, staffTable } from "@workspace/db";
import { mapDbRoleToMobile, sectionForRole } from "./permissions.js";
import { autoAssignWaiterToOrder } from "../staff-auto-assignment.js";
import { recordOrderPaymentInLedger, reverseOrderPaymentInLedger } from "../order-payment-ledger.js";
import { broadcastEvent, broadcastOrderEvent } from "../sse.js";
import { canTransition } from "../order-status.js";

export const KITCHEN_SECTIONS = ["Main", "Tandoor", "Chinese", "Beverage", "Bar", "Dessert", "Bakery", "Floor"];

// "served" belongs here: the web KDS's Serve button writes that literal status, and the
// rest of the API already treats it as an open order (orders.ts OPEN_STATUSES,
// tables.ts ACTIVE_ORDER_STATUSES). Leaving it out made an order pressed "Served" on the
// browser KDS vanish from the waiter's phone before anyone had delivered it.
const ACTIVE_DB = ["pending", "new", "confirmed", "accepted", "preparing", "ready", "serving", "served", "delivered", "delayed", "billing"];
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
    case "new": return "new";
    case "confirmed": return "accepted";
    case "accepted": return "accepted";
    case "preparing": return "preparing";
    case "delayed": return "delayed";
    case "ready": return "ready";
    case "serving": return "serving";
    // The kitchen has handed the food over but nobody has delivered it yet, so the waiter
    // still needs the "Delivered" action — that is the mobile "serving" state, not "served".
    case "served": return "serving";
    case "delivered": return "served";
    case "billing": return "ready";
    case "completed": return "served";
    case "cancelled": return "rejected";
    default: return "accepted";
  }
}

// `currentDbStatus` is the value straight off the row, not the mobile-facing one.
// It used to be the mobile status, which meant "hold" (and any action this switch did
// not recognise) wrote a mobile word — "new", "accepted", "on_hold" — into
// orders.status. Those are not in DISPLAY_DB here, nor in tables.ts
// ACTIVE_ORDER_STATUSES, so a held ticket dropped off the kitchen display and the
// waiter board and freed its table, with no screen left to press Release on.
// Returning null for an unrecognised action lets the caller answer 400 instead of
// writing a status nobody asked for.
function mobileToDbStatus(
  action: string,
  currentDbStatus: string,
): { status: string; meta?: Record<string, unknown> } | null {
  switch (action) {
    case "accept": return { status: "confirmed" };
    case "prepare": return { status: "preparing" };
    case "ready": return { status: "ready" };
    case "delay": return { status: "delayed" };
    case "reject":
    case "cancel": return { status: "cancelled" };
    // A hold parks the ticket where it is; it is the metadata flag that holds it,
    // so the row keeps the status it already had.
    case "hold": return { status: currentDbStatus, meta: { kitchenHold: true } };
    case "release": return { status: "preparing", meta: { kitchenHold: false } };
    case "refire": return { status: "preparing", meta: { reFire: true } };
    // Waiter delivery flow: pick up a ready order (on the way), then deliver it.
    case "serve": return { status: "serving" };
    case "deliver": return { status: "completed" };
    default: return null;
  }
}

// ─── Guest-facing tracking ─────────────────────────────────────────────────
// The browser KDS goes through PUT /restaurants/:id/orders/:id (routes/orders.ts),
// which appends a line to metadata.tracking.kitchenUpdates on every status change and
// stamps chefAssignedAt / cookingStartedAt. The app's KDS comes through here and used
// to write nothing but the status column, so the guest's live tracker sat on "Order
// received — sent to kitchen" from the moment the order was placed until it arrived at
// the table, however many buttons the kitchen pressed. Same wording as the web path, so
// a guest sees the same timeline whichever screen the kitchen worked from.
const GUEST_STATUS_MESSAGES: Record<string, string> = {
  confirmed: "Order accepted by kitchen",
  accepted: "Order accepted by kitchen",
  preparing: "Kitchen started preparing your order",
  ready: "Order ready for pickup",
  serving: "Waiter is on the way",
  delivered: "Order delivered to table",
  completed: "Order completed",
  cancelled: "Order cancelled",
  delayed: "Order marked as delayed",
};

function updateType(status: string): string {
  if (status === "delayed") return "delay";
  if (status === "ready") return "ready";
  return "info";
}

/**
 * Append the guest-visible timeline entry for a status change and stamp the kitchen's
 * own timings on the order. Returns the new metadata object; the caller writes it.
 *
 * The timings are what makes prep time measurable at all — before this the only time on
 * an order was createdAt, so "average preparation time" was really "average age of the
 * open queue".
 */
export function withGuestTracking(
  meta: Record<string, unknown>,
  fromStatus: string,
  toStatus: string,
  who: { chefName?: string; waiterName?: string } = {},
): Record<string, unknown> {
  if (fromStatus === toStatus) return meta;
  const tracking = (meta.tracking && typeof meta.tracking === "object"
    ? { ...(meta.tracking as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  const updates = Array.isArray(tracking.kitchenUpdates) ? [...tracking.kitchenUpdates] : [];
  const now = new Date().toISOString();

  // A waiter confirming the handover lands the order on "completed"; to the guest that
  // moment is the food arriving, not an accounting state.
  const message = toStatus === "completed" && who.waiterName
    ? GUEST_STATUS_MESSAGES.delivered
    : GUEST_STATUS_MESSAGES[toStatus];
  if (message) updates.unshift({ at: now, message, type: updateType(toStatus) });

  if ((toStatus === "confirmed" || toStatus === "accepted") && !tracking.acceptedAt) {
    tracking.acceptedAt = now;
  }
  if (toStatus === "preparing" && !tracking.chefAssignedAt) {
    tracking.chefAssignedAt = now;
    const chef = who.chefName ?? (tracking.chefName as string | undefined) ?? "Head Chef";
    tracking.chefName = chef;
    // Staff are often already named "Chef <name>" on the roster; don't say it twice.
    const label = /^chef/i.test(chef) ? chef : `Chef ${chef}`;
    updates.unshift({ at: now, message: `${label} assigned`, type: "chef" });
  }
  if (toStatus === "preparing" || toStatus === "ready") {
    tracking.cookingStartedAt = tracking.cookingStartedAt ?? now;
  }
  if (toStatus === "ready" && !tracking.readyAt) tracking.readyAt = now;
  if (toStatus === "serving") tracking.waiterStatus = "on_the_way";
  if (toStatus === "delivered" || toStatus === "completed") {
    tracking.waiterStatus = "delivered";
    tracking.deliveredAt = tracking.deliveredAt ?? now;
  }
  // The kitchen pressing Delay is what tells the guest their order is running late —
  // buildTrackingSnapshot reads tracking.isDelayed. And once the food is actually up,
  // the flag has to come off, or the tracker keeps showing "delayed" over a plated dish.
  if (toStatus === "delayed") {
    tracking.isDelayed = true;
    tracking.delayReason = tracking.delayReason ?? "Kitchen delay — your order is being prioritised";
  } else if (["ready", "serving", "served", "delivered", "completed"].includes(toStatus)) {
    delete tracking.isDelayed;
    delete tracking.delayReason;
  }
  if (who.waiterName) tracking.waiterName = who.waiterName;

  tracking.kitchenUpdates = updates;
  return { ...meta, tracking };
}

/** Seconds actually spent cooking, from the moment prep started to the ready bump. */
function measuredPrepSeconds(meta: Record<string, unknown>): number | null {
  const tracking = (meta.tracking && typeof meta.tracking === "object"
    ? meta.tracking
    : {}) as Record<string, unknown>;
  const started = typeof tracking.cookingStartedAt === "string" ? Date.parse(tracking.cookingStartedAt) : NaN;
  if (!Number.isFinite(started)) return null;
  const ready = typeof tracking.readyAt === "string" ? Date.parse(tracking.readyAt) : NaN;
  const end = Number.isFinite(ready) ? ready : Date.now();
  const seconds = Math.floor((end - started) / 1000);
  return seconds >= 0 ? seconds : null;
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
    // How long this ticket has actually been on the pass, measured from the stamps the
    // kitchen's own actions leave. Null until someone starts prep — the dashboard
    // averages only the tickets that have a real measurement.
    prepSeconds: measuredPrepSeconds(meta),
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
    cleared: Boolean(meta.tableCleared),
    billRequested: Boolean(meta.billRequested),
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

/**
 * How many staff are actually rostered to each kitchen section, from the staff table.
 * The dashboard used to print "N orders · 2 staff" where the staff figure was derived
 * from the order count (0 -> 1, 1-3 -> 2, 4+ -> 3) and had never been near the roster.
 */
async function staffPerSection(restaurantId: number): Promise<Record<string, number>> {
  const rows = await db.select({ role: staffTable.role })
    .from(staffTable)
    .where(and(eq(staffTable.restaurantId, restaurantId), eq(staffTable.isActive, true)));
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const sectionName = sectionForRole(mapDbRoleToMobile(r.role));
    counts[sectionName] = (counts[sectionName] ?? 0) + 1;
  }
  return counts;
}

function buildDashboard(
  section: string,
  orders: ReturnType<typeof mapOrderRow>[],
  sectionStaff: Record<string, number> = {},
) {
  const filtered = filterSection(orders, section);
  const active = filtered.filter(o => KITCHEN_ACTIVE.has(o.status)).length;
  const delayed = filtered.filter(o => o.status === "delayed").length;
  const vip = filtered.filter(o => o.vip).length;
  const priority = filtered.filter(o => o.priority !== "normal").length;
  const pending = filtered.filter(o => o.status === "new" || o.status === "accepted").length;
  const completed = filtered.filter(o => o.status === "ready" || o.status === "served").length;
  const rejected = filtered.filter(o => o.status === "rejected").length;
  const rushCount = filtered.filter(o => o.status === "delayed" || o.priority === "express" || o.timerSeconds > 600).length;
  // "Average preparation time" now averages time actually spent cooking (prep started
  // -> ready), not the age of whatever is on the board. It also no longer falls back to
  // a fixed 780 seconds, which put a confident "13:00" on the dashboard of a kitchen
  // that had not cooked anything.
  const measured = filtered.map(o => o.prepSeconds).filter((n): n is number => n != null);
  const avgSeconds = measured.length
    ? Math.round(measured.reduce((s, n) => s + n, 0) / measured.length)
    : 0;
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
      { key: "avgPrepTime", label: "Average preparation time", value: formatDuration(avgSeconds), detail: measured.length ? `${measured.length} order(s) timed` : "Nothing cooked yet", tone: "info" },
      { key: "delayRatio", label: "Delay ratio", value: `${delayRatio}%`, detail: delayed > 2 ? "Above target" : "On target", tone: "warning" },
      { key: "orderBacklog", label: "Order backlog", value: String(pending + active), detail: "Queue depth", tone: "danger" },
    ],
    sectionWorkload: KITCHEN_SECTIONS.map(name => {
      const count = filtered.filter(o => o.section === name && KITCHEN_ACTIVE.has(o.status)).length;
      return { section: name, activeOrders: count, load: Math.min(1, count / 6), staffAssigned: sectionStaff[name] ?? 0 };
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
      .filter(o => ["new", "accepted", "preparing", "delayed", "ready", "serving", "served"].includes(o.status) && !o.cleared)
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
    // Room requests are not cooked, so there is no prep time to measure.
    prepSeconds: null as number | null,
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
  return buildDashboard(section, orders, await staffPerSection(restaurantId));
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

export async function applyKdsAction(
  restaurantId: number,
  orderIdRaw: string,
  action: string,
  /** The staff member who pressed the button, so the guest sees a name rather than
   *  the "Head Chef" placeholder the web path falls back to. */
  performedBy?: string,
  /** UPI ID / UTR / card RRN — required before online methods can be marked paid. */
  paymentReference?: string | null,
) {
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
    // Already settled — return as-is. Re-collect used to re-broadcast and re-hit
    // the ledger path; the helper de-duplicates income, but staff earnings and
    // floor events must not fire again for the same bill.
    if (existing.paymentStatus === "paid") {
      return mapOrderRow(existing);
    }

    const method = action.includes("_") ? action.split("_")[1] : "cash";
    const onlineAtTable = ["upi", "card", "nfc", "qr", "wallet", "netbanking"].includes(method);
    const ref = String(paymentReference ?? "").trim();
    if (onlineAtTable && !ref) {
      throw new Error("PAYMENT_REFERENCE_REQUIRED");
    }

    const meta = (typeof existing.metadata === "object" && existing.metadata !== null
      ? existing.metadata : {}) as Record<string, unknown>;
    const existingPayment = (typeof meta.payment === "object" && meta.payment !== null
      ? meta.payment : {}) as Record<string, unknown>;
    const paymentDetail = onlineAtTable || ref ? {
      ...existingPayment,
      method,
      status: "paid",
      ...(method === "upi" ? { upiId: ref } : { utr: ref || undefined }),
      collectedBy: performedBy ?? existing.waiterName ?? null,
      collectedFrom: "Waiter app",
      collectedAt: new Date().toISOString(),
    } : existingPayment;

    const [paid] = await db.update(ordersTable).set({
      paymentStatus: "paid",
      paymentMethod: method,
      ...(onlineAtTable || ref
        ? { metadata: { ...meta, payment: paymentDetail } }
        : {}),
    }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();
    // Put it in the finance ledger too, exactly like the web panel does —
    // otherwise money a waiter collects in the app never reaches Finance or the
    // Cash Counter. The helper de-duplicates, so an order paid here and later
    // touched from the web still books exactly one income row.
    await recordOrderPaymentInLedger({
      restaurantId,
      order: paid,
      method,
      reference: ref || null,
      performedBy: performedBy ?? paid.waiterName ?? null,
    });
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
    // Mark the table's orders completed AND flag them cleared, so they drop out
    // of the waiter's "My deliveries" (the table is done, ready for the next guest).
    await db.update(ordersTable).set({
      status: "completed",
      metadata: sql`COALESCE(${ordersTable.metadata}, '{}'::jsonb) || '{"tableCleared": true}'::jsonb`,
    }).where(and(
      eq(ordersTable.restaurantId, restaurantId),
      existing.tableId
        ? eq(ordersTable.tableId, existing.tableId)
        : eq(ordersTable.tableName, existing.tableName),
      // Include already-delivered ("completed") orders too, so clearing a table
      // whose order was just delivered still flags it cleared.
      inArray(ordersTable.status, DISPLAY_DB),
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
  const mapped = mobileToDbStatus(action, existing.status);
  // An action this endpoint does not know used to fall through to "keep the current
  // status", which meant a typo or a stale app build silently rewrote the status column.
  // Say so instead.
  if (!mapped) throw new Error("UNKNOWN_ACTION");

  // Waiter pickup/delivery must not skip the kitchen. Shared canTransition still
  // allows new→serving for legacy web paths; mobile refuses that shortcut.
  if (action === "serve") {
    const from = String(existing.status ?? "").toLowerCase();
    if (!["ready", "serving", "served"].includes(from)) {
      throw new Error("INVALID_TRANSITION: Order must be ready before starting delivery");
    }
  }
  if (action === "deliver") {
    const from = String(existing.status ?? "").toLowerCase();
    if (!["serving", "served"].includes(from)) {
      throw new Error("INVALID_TRANSITION: Start delivery before marking delivered");
    }
  }

  // The same guard the browser KDS goes through (routes/orders.ts). Without it the app
  // could walk a settled order backwards — a delivered order pressed "Accept" reappeared
  // in the queue as a fresh ticket and would have been cooked twice.
  if (mapped.status !== existing.status) {
    const allowed = canTransition(existing.status, mapped.status);
    if (!allowed.ok) throw new Error(`INVALID_TRANSITION: ${allowed.reason}`);
  }

  let nextMeta = { ...meta, ...(mapped.meta ?? {}) };
  if (mapped.meta?.kitchenHold === false) delete nextMeta.kitchenHold;
  if (mapped.meta?.reFire) nextMeta.reFire = true;
  // Everything the guest's live tracker shows — the timeline, the chef's name, the
  // waiter's progress — plus the kitchen's own timings.
  nextMeta = withGuestTracking(nextMeta, existing.status, mapped.status, {
    chefName: performedBy,
    waiterName: action === "serve" || action === "deliver" ? performedBy : undefined,
  });

  let [updated] = await db.update(ordersTable).set({
    status: mapped.status,
    metadata: nextMeta,
  }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();

  if (!updated) throw new Error("ORDER_NOT_FOUND");

  // Cancelling here has to release the money too, exactly as the web panel does
  // — otherwise Revenue drops the order but Finance keeps the collected amount.
  if (mapped.status === "cancelled") {
    await reverseOrderPaymentInLedger({ restaurantId, order: updated, reason: `cancelled from app (${action})` });
  }

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

