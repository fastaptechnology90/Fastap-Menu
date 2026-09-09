import { eq, and } from "drizzle-orm";
import {
  db,
  ordersTable,
  housekeepingTasksTable,
  maintenanceRequestsTable,
  roomServiceRequestsTable,
  waiterCallsTable,
  tasksTable,
  inventoryItemsTable,
  hotelRoomsTable,
} from "@workspace/db";
import type { MobileSession } from "./session.js";
import {
  autoAssignHousekeepingTask,
  autoAssignRoomServiceRequest,
  autoAssignWaiterToOrder,
} from "../staff-auto-assignment.js";
import { fetchKitchenOrders, withGuestTracking } from "./kitchen-orders.js";
import { canTransition } from "../order-status.js";

function parseTaskId(raw: string): { kind: "hk" | "mt" | "order" | "rs" | "call"; id: number } | null {
  const hk = raw.match(/^HK-(\d+)$/i);
  if (hk) return { kind: "hk", id: parseInt(hk[1], 10) };
  const mt = raw.match(/^MT-(\d+)$/i);
  if (mt) return { kind: "mt", id: parseInt(mt[1], 10) };
  const wt = raw.match(/^WT-(.+)$/i);
  if (wt) {
    const id = parseInt(wt[1].replace(/^ORD-/, ""), 10);
    return Number.isFinite(id) ? { kind: "order", id } : null;
  }
  const rs = raw.match(/^RS-(\d+)$/i);
  if (rs) return { kind: "rs", id: parseInt(rs[1], 10) };
  const call = raw.match(/^CALL-(\d+)$/i);
  if (call) return { kind: "call", id: parseInt(call[1], 10) };
  const numeric = parseInt(raw, 10);
  if (Number.isFinite(numeric)) return { kind: "hk", id: numeric };
  return null;
}

async function updateHousekeepingTask(
  restaurantId: number,
  taskId: number,
  action: string,
  staffName: string,
) {
  const [task] = await db.select().from(housekeepingTasksTable).where(
    and(eq(housekeepingTasksTable.id, taskId), eq(housekeepingTasksTable.restaurantId, restaurantId)),
  );
  if (!task) throw new Error("TASK_NOT_FOUND");

  const patch: Record<string, unknown> = {};
  switch (action) {
    case "start_task":
      patch.status = "in_progress";
      patch.assignedTo = task.assignedTo ?? staffName;
      break;
    case "complete_checklist":
    case "mark_sanitized":
    case "verify_staff":
      patch.status = "completed";
      patch.completedAt = new Date();
      patch.assignedTo = staffName;
      break;
    case "schedule_deep_clean":
      patch.status = "in_progress";
      patch.assignedTo = staffName;
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  await db.update(housekeepingTasksTable).set(patch).where(eq(housekeepingTasksTable.id, taskId));

  // Finishing the clean has to release the room, or nobody outside the housekeeping app
  // ever learns it happened. hotel_rooms.status carries a documented "cleaning" state and
  // Reception only offers rooms whose status is "vacant", so a room parked in "cleaning"
  // could not be sold again — there was nothing anywhere that moved it back.
  // Deliberately narrow: only a room that is actually mid-clean is touched, so an
  // occupied, reserved or out-of-service room is never freed under a guest.
  let roomReleased: string | undefined;
  if (patch.status === "completed" && task.roomNumber) {
    const [room] = await db.update(hotelRoomsTable)
      .set({ status: "vacant" })
      .where(and(
        eq(hotelRoomsTable.restaurantId, restaurantId),
        eq(hotelRoomsTable.number, task.roomNumber),
        eq(hotelRoomsTable.status, "cleaning"),
      ))
      .returning();
    if (room) roomReleased = room.number;
  }

  return {
    success: true,
    message: roomReleased
      ? `${action.replace(/_/g, " ")} recorded · ${task.title} · Room ${roomReleased} is ready`
      : `${action.replace(/_/g, " ")} recorded · ${task.title}`,
  };
}

async function updateMaintenanceRequest(
  restaurantId: number,
  requestId: number,
  action: string,
  staffName: string,
) {
  const [req] = await db.select().from(maintenanceRequestsTable).where(
    and(eq(maintenanceRequestsTable.id, requestId), eq(maintenanceRequestsTable.restaurantId, restaurantId)),
  );
  if (!req) throw new Error("TASK_NOT_FOUND");

  const patch: Record<string, unknown> = { assignedTo: staffName };
  switch (action) {
    case "start_task":
    case "schedule_deep_clean":
      patch.status = "in_progress";
      break;
    case "verify_staff":
    case "complete_checklist":
    case "mark_sanitized":
      patch.status = "resolved";
      patch.resolvedAt = new Date();
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  await db.update(maintenanceRequestsTable).set(patch).where(eq(maintenanceRequestsTable.id, requestId));
  return { success: true, message: `Maintenance updated · ${req.title}` };
}

async function updateRoomServiceRequest(
  restaurantId: number,
  requestId: number,
  action: string,
  staffName: string,
) {
  const [req] = await db.select().from(roomServiceRequestsTable).where(
    and(eq(roomServiceRequestsTable.id, requestId), eq(roomServiceRequestsTable.restaurantId, restaurantId)),
  );
  if (!req) throw new Error("ORDER_NOT_FOUND");

  const patch: Record<string, unknown> = {};
  switch (action) {
    case "acknowledge_vip":
    case "start_preparation":
      patch.status = "in_progress";
      patch.assignedTo = staffName;
      break;
    case "assign_tray":
      patch.status = "in_progress";
      patch.assignedTo = staffName;
      break;
    case "mark_delivered":
      patch.status = "completed";
      patch.completedAt = new Date();
      patch.assignedTo = staffName;
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  await db.update(roomServiceRequestsTable).set(patch).where(eq(roomServiceRequestsTable.id, requestId));
  return { success: true, message: `Room ${req.roomNumber} · ${action.replace(/_/g, " ")}` };
}

async function updateWaiterOrder(
  restaurantId: number,
  orderId: number,
  action: string,
  staffName: string,
  staffId: number,
) {
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)),
  );
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const meta = (typeof order.metadata === "object" && order.metadata !== null
    ? order.metadata
    : {}) as Record<string, unknown>;
  const tracking = (typeof meta.tracking === "object" && meta.tracking !== null
    ? meta.tracking
    : {}) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  switch (action) {
    case "assign":
      patch.waiterName = staffName;
      // The staff row id, not null. The guest's tracker resolves the waiter's phone
      // number through orders.waiter_id, so nulling it here took the "call your waiter"
      // number off the guest's screen the instant a waiter claimed the table — and cut
      // the order out of anything that joins waiter work to a staff member.
      patch.waiterId = staffId;
      patch.metadata = {
        ...meta,
        tracking: { ...tracking, waiterStatus: "assigned", waiterAssignedAt: now, waiterName: staffName },
      };
      break;
    case "start_delivery":
      patch.status = "serving";
      patch.waiterName = staffName;
      patch.waiterId = order.waiterId ?? staffId;
      patch.metadata = {
        ...withGuestTracking(meta, order.status, "serving", { waiterName: staffName }),
      };
      (patch.metadata as Record<string, unknown>).tracking = {
        ...((patch.metadata as Record<string, unknown>).tracking as Record<string, unknown>),
        deliveryStartedAt: now,
      };
      break;
    case "confirm_delivery":
      patch.status = "completed";
      patch.metadata = withGuestTracking(meta, order.status, "completed", { waiterName: staffName });
      break;
    case "acknowledge":
      patch.metadata = {
        ...meta,
        tracking: { ...tracking, waiterAcknowledgedAt: now },
      };
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  // Same guard the browser panel uses, so the waiter app cannot walk a settled or
  // cancelled order back onto the floor.
  if (typeof patch.status === "string" && patch.status !== order.status) {
    const allowed = canTransition(order.status, patch.status);
    if (!allowed.ok) throw new Error(`INVALID_TRANSITION: ${allowed.reason}`);
  }

  await db.update(ordersTable).set(patch).where(eq(ordersTable.id, orderId));
  return { success: true, message: `Order ${order.id} · ${action.replace(/_/g, " ")}` };
}

/**
 * The room-service board speaks in trays; a kitchen order placed from a room moves
 * through the same delivery states as any other order.
 */
function roomActionToOrderAction(action: string): string {
  switch (action) {
    case "assign_tray":
    case "start_preparation":
      return "start_delivery";
    case "mark_delivered":
      return "confirm_delivery";
    case "acknowledge_vip":
      return "acknowledge";
    default:
      return action;
  }
}

async function resolveWaiterCall(restaurantId: number, callId: number, staffName: string) {
  const [call] = await db.update(waiterCallsTable).set({ isResolved: true }).where(
    and(eq(waiterCallsTable.id, callId), eq(waiterCallsTable.restaurantId, restaurantId)),
  ).returning();
  if (!call) throw new Error("CALL_NOT_FOUND");
  return {
    success: true,
    message: `${staffName} resolved table call · ${call.tableName ?? "table"}`,
  };
}

async function updatePanelTask(
  restaurantId: number,
  taskId: number,
  action: string,
  staffName: string,
) {
  const [task] = await db.select().from(tasksTable).where(
    and(eq(tasksTable.id, taskId), eq(tasksTable.restaurantId, restaurantId)),
  );
  if (!task) throw new Error("TASK_NOT_FOUND");

  const patch: Record<string, unknown> = {};
  switch (action) {
    case "start_task":
    case "assign_task":
      patch.status = "in_progress";
      patch.assignedTo = staffName;
      break;
    case "complete_task":
      patch.status = "completed";
      patch.completedAt = new Date();
      patch.assignedTo = staffName;
      break;
    case "escalate_task":
      patch.priority = "urgent";
      patch.status = "in_progress";
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  await db.update(tasksTable).set(patch).where(eq(tasksTable.id, taskId));
  return { success: true, message: `${action.replace(/_/g, " ")} · ${task.title}` };
}

async function balanceWaiterWorkload(restaurantId: number) {
  const orders = await fetchKitchenOrders(restaurantId);
  const ready = orders.filter((o) => o.status === "ready" && !o.waiterName);
  let assigned = 0;
  for (const o of ready) {
    const id = parseInt(String(o.id).replace(/^ORD-/, ""), 10);
    if (!Number.isFinite(id)) continue;
    const updated = await autoAssignWaiterToOrder(restaurantId, id);
    if (updated?.waiterName) assigned++;
  }
  return {
    success: true,
    message: assigned
      ? `Balanced workload across ${assigned} ready order(s)`
      : "Waiter queues are already balanced",
    movedOrders: assigned,
  };
}

export async function handleMobilePost(
  path: string,
  body: Record<string, unknown>,
  session: MobileSession,
): Promise<{ success: boolean; message: string; movedOrders?: number } | null> {
  const action = String(body.action ?? "");
  const restaurantId = session.restaurantId;
  const staffName = session.user.name;
  const staffId = session.staffId;

  if (path === "/waiter-auto-assignment/auto-allocate") {
    const orders = await fetchKitchenOrders(restaurantId);
    const ready = orders.filter((o) => o.status === "ready" && !o.waiterName);
    let assigned = 0;
    for (const o of ready) {
      const id = parseInt(String(o.id).replace(/^ORD-/, ""), 10);
      if (!Number.isFinite(id)) continue;
      const updated = await autoAssignWaiterToOrder(restaurantId, id);
      if (updated?.waiterName) assigned++;
    }
    return {
      success: true,
      message: assigned
        ? `Auto-assigned ${assigned} ready order(s) to waiters`
        : "No ready orders waiting for waiter assignment",
      movedOrders: assigned,
    };
  }

  if (path === "/waiter-auto-assignment/balance-workload") {
    return balanceWaiterWorkload(restaurantId);
  }

  if (path.startsWith("/waiter-auto-assignment/tasks/") && path.endsWith("/action")) {
    const taskId = path.split("/")[3];
    const parsed = parseTaskId(taskId);
    if (!parsed || parsed.kind !== "order") throw new Error("ORDER_NOT_FOUND");
    return updateWaiterOrder(restaurantId, parsed.id, action, staffName, staffId);
  }

  if (path.startsWith("/waiter-auto-assignment/notifications/") && path.endsWith("/action")) {
    const notificationId = path.split("/")[3];
    const parsed = parseTaskId(notificationId);
    if (!parsed) throw new Error("CALL_NOT_FOUND");
    if (parsed.kind === "call") {
      if (action === "resolve_call" || action === "acknowledge") {
        return resolveWaiterCall(restaurantId, parsed.id, staffName);
      }
    }
    if (parsed.kind === "order") {
      return updateWaiterOrder(restaurantId, parsed.id, action, staffName, staffId);
    }
    throw new Error("UNKNOWN_ACTION");
  }

  if (path.startsWith("/hygiene/tasks/") && path.endsWith("/action")) {
    const taskId = path.split("/")[3];
    const parsed = parseTaskId(taskId);
    if (!parsed) throw new Error("TASK_NOT_FOUND");
    if (parsed.kind === "hk") {
      return updateHousekeepingTask(restaurantId, parsed.id, action, staffName);
    }
    if (parsed.kind === "mt") {
      return updateMaintenanceRequest(restaurantId, parsed.id, action, staffName);
    }
    throw new Error("TASK_NOT_FOUND");
  }

  if (path === "/hygiene/audit/start") {
    return { success: true, message: "Hygiene audit started" };
  }

  if (path.startsWith("/chef-tasks/") && path.endsWith("/action")) {
    const rawId = path.split("/")[2];
    const id = parseInt(rawId.replace(/^TSK-/, ""), 10);
    if (!Number.isFinite(id)) throw new Error("TASK_NOT_FOUND");
    return updatePanelTask(restaurantId, id, action, staffName);
  }

  if (path.startsWith("/prep/tasks/") && path.endsWith("/action")) {
    const rawId = path.split("/")[3];
    const id = parseInt(rawId.replace(/^PREP-/, ""), 10);
    if (!Number.isFinite(id)) throw new Error("TASK_NOT_FOUND");
    return updatePanelTask(restaurantId, id, action, staffName);
  }

  if (path === "/inventory/sync") {
    await db.update(inventoryItemsTable)
      .set({ lastUpdated: new Date() })
      .where(eq(inventoryItemsTable.restaurantId, restaurantId));
    return { success: true, message: "Inventory synchronized with restaurant panel" };
  }

  if (path === "/inventory/deduct") {
    const itemId = parseInt(String(body.itemId ?? "").replace(/^ING-/, ""), 10);
    const quantity = Number(body.quantity ?? 0);
    const [item] = await db.select().from(inventoryItemsTable).where(
      and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.restaurantId, restaurantId)),
    );
    if (!item) throw new Error("ITEM_NOT_FOUND");
    const onHand = parseFloat(String(item.currentStock ?? 0));
    const next = Math.max(0, onHand - quantity);
    await db.update(inventoryItemsTable).set({ currentStock: String(next), lastUpdated: new Date() })
      .where(eq(inventoryItemsTable.id, itemId));
    return { success: true, message: `Deducted ${quantity} ${item.unit} · ${item.name}` };
  }

  if (path === "/inventory/alert-action" || path === "/inventory/substitute" || path === "/inventory/validate") {
    return { success: true, message: `${action || "inventory"} action recorded` };
  }

  if (path.startsWith("/room-service/orders/") && path.endsWith("/action")) {
    const rawId = path.split("/")[3];
    // Two kinds of card share this board: a room_service_requests row ("RS-12") and a
    // kitchen order placed from a room ("RS-ORD-535"). The RS-ORD form fell through the
    // RS-(\d+) match and every button on those cards answered 404, so a housekeeper
    // could see a room's food order and act on none of it.
    const orderMatch = rawId.match(/^RS-ORD-(?:ORD-)?(\d+)$/i);
    if (orderMatch) {
      return updateWaiterOrder(restaurantId, parseInt(orderMatch[1], 10), roomActionToOrderAction(action), staffName, staffId);
    }
    const parsed = parseTaskId(rawId.startsWith("RS-") ? rawId : `RS-${rawId}`);
    if (!parsed || parsed.kind !== "rs") throw new Error("ORDER_NOT_FOUND");
    return updateRoomServiceRequest(restaurantId, parsed.id, action, staffName);
  }

  if (path.includes("/room-service/") && path.endsWith("/action")) {
    const segments = path.split("/");
    const rawId = segments[segments.length - 2];
    const parsed = parseTaskId(rawId.startsWith("RS-") ? rawId : `RS-${rawId}`);
    if (parsed?.kind === "rs") {
      return updateRoomServiceRequest(restaurantId, parsed.id, action, staffName);
    }
    const orderParsed = parseTaskId(rawId.replace(/^RS-ORD-/, ""));
    if (orderParsed?.kind === "order") {
      return updateWaiterOrder(restaurantId, orderParsed.id, action, staffName, staffId);
    }
  }

  return null;
}

export async function autoAssignPendingWaiterOrders(restaurantId: number) {
  const orders = await fetchKitchenOrders(restaurantId);
  let count = 0;
  for (const o of orders) {
    if (o.status === "ready" && !o.waiterName) {
      const id = parseInt(String(o.id).replace(/^ORD-/, ""), 10);
      if (!Number.isFinite(id)) continue;
      const updated = await autoAssignWaiterToOrder(restaurantId, id);
      if (updated?.waiterName) count++;
    }
  }
  return count;
}

export async function autoAssignPendingHousekeeping(restaurantId: number) {
  const tasks = await db.select().from(housekeepingTasksTable).where(
    eq(housekeepingTasksTable.restaurantId, restaurantId),
  );
  let count = 0;
  for (const task of tasks) {
    if (!task.assignedTo && task.status === "pending") {
      const updated = await autoAssignHousekeepingTask(restaurantId, task.id);
      if (updated?.assignedTo) count++;
    }
  }
  return count;
}

export async function autoAssignPendingRoomService(restaurantId: number) {
  const reqs = await db.select().from(roomServiceRequestsTable).where(
    eq(roomServiceRequestsTable.restaurantId, restaurantId),
  );
  let count = 0;
  for (const req of reqs) {
    if (!req.assignedTo && req.status === "pending") {
      const updated = await autoAssignRoomServiceRequest(restaurantId, req.id);
      if (updated?.assignedTo) count++;
    }
  }
  return count;
}
