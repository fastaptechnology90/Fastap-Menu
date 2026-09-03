import { eq, and } from "drizzle-orm";
import {
  db,
  staffTable,
  housekeepingTasksTable,
  roomServiceRequestsTable,
  maintenanceRequestsTable,
  ordersTable,
  notificationsLogTable,
  chatMessagesTable,
} from "@workspace/db";
import { broadcastEvent } from "./sse.js";

type StaffPick = { id: number; name: string; role: string; email: string };

const HK_ACTIVE = new Set(["pending", "in_progress"]);
const RS_ACTIVE = new Set(["pending", "accepted", "in_progress"]);
const WAITER_ACTIVE = new Set(["ready", "serving"]);

async function activeStaff(restaurantId: number, roles: string[]): Promise<StaffPick[]> {
  const rows = await db.select().from(staffTable).where(
    and(eq(staffTable.restaurantId, restaurantId), eq(staffTable.isActive, true), eq(staffTable.status, "active")),
  );
  const roleSet = new Set(roles);
  return rows.filter(s => roleSet.has(s.role)).map(s => ({ id: s.id, name: s.name, role: s.role, email: s.email }));
}

async function housekeepingLoad(restaurantId: number, name: string) {
  const tasks = await db.select({ status: housekeepingTasksTable.status }).from(housekeepingTasksTable).where(
    and(eq(housekeepingTasksTable.restaurantId, restaurantId), eq(housekeepingTasksTable.assignedTo, name)),
  );
  return tasks.filter(t => HK_ACTIVE.has(t.status)).length;
}

async function roomServiceLoad(restaurantId: number, name: string) {
  const reqs = await db.select({ status: roomServiceRequestsTable.status }).from(roomServiceRequestsTable).where(
    and(eq(roomServiceRequestsTable.restaurantId, restaurantId), eq(roomServiceRequestsTable.assignedTo, name)),
  );
  return reqs.filter(r => RS_ACTIVE.has(r.status)).length;
}

async function waiterLoad(restaurantId: number, name: string) {
  const orders = await db.select({ status: ordersTable.status }).from(ordersTable).where(
    and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.waiterName, name)),
  );
  return orders.filter(o => WAITER_ACTIVE.has(o.status)).length;
}

async function pickLeastLoaded(candidates: StaffPick[], loadOf: (name: string) => Promise<number>): Promise<StaffPick | null> {
  if (!candidates.length) return null;
  let best = candidates[0];
  let bestLoad = Infinity;
  for (const c of candidates) {
    const load = await loadOf(c.name);
    if (load < bestLoad) {
      bestLoad = load;
      best = c;
    }
  }
  return best;
}

export async function notifyStaffMember(input: {
  restaurantId: number;
  staffName: string;
  staffRole: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { restaurantId, staffName, staffRole, title, message, metadata = {} } = input;
  const channel =
    staffRole === "housekeeping" ? "housekeeping" : staffRole === "waiter" ? "waiter" : "manager";

  await db.insert(notificationsLogTable).values({
    restaurantId,
    type: "push",
    title,
    message,
    recipient: staffName,
    recipientType: "staff",
    status: "sent",
    metadata: { ...metadata, autoAssigned: true },
  }).catch(() => {});

  await db.insert(chatMessagesTable).values({
    restaurantId,
    senderId: "system",
    senderName: "Fastap Auto",
    senderRole: "system",
    message: `${title}: ${message}`,
    messageType: "alert",
    channel,
  }).catch(() => {});

  broadcastEvent("staff_notification", {
    restaurantId,
    staffName,
    staffRole,
    title,
    message,
    autoAssigned: true,
    ...metadata,
  });
}

export async function autoAssignHousekeepingTask(restaurantId: number, taskId: number) {
  const [task] = await db.select().from(housekeepingTasksTable).where(
    and(eq(housekeepingTasksTable.id, taskId), eq(housekeepingTasksTable.restaurantId, restaurantId)),
  );
  if (!task || task.assignedTo) return task;

  const candidates = await activeStaff(restaurantId, ["housekeeping", "manager"]);
  const picked = await pickLeastLoaded(candidates, n => housekeepingLoad(restaurantId, n));
  if (!picked) return task;

  const [updated] = await db.update(housekeepingTasksTable).set({
    assignedTo: picked.name,
    status: task.status === "pending" ? "in_progress" : task.status,
  }).where(eq(housekeepingTasksTable.id, taskId)).returning();

  const room = task.roomNumber || task.location;
  await notifyStaffMember({
    restaurantId,
    staffName: picked.name,
    staffRole: picked.role,
    title: `Housekeeping — ${room}`,
    message: `${task.title} assigned automatically`,
    metadata: { taskId, roomNumber: task.roomNumber, module: "housekeeping" },
  });

  broadcastEvent("housekeeping_assigned", { restaurantId, taskId, room, assignedTo: picked.name });
  return updated;
}

export async function autoAssignMaintenanceRequest(restaurantId: number, requestId: number) {
  const [req] = await db.select().from(maintenanceRequestsTable).where(
    and(eq(maintenanceRequestsTable.id, requestId), eq(maintenanceRequestsTable.restaurantId, restaurantId)),
  );
  if (!req || req.assignedTo) return req;

  const candidates = await activeStaff(restaurantId, ["housekeeping", "manager"]);
  const picked = await pickLeastLoaded(candidates, n => housekeepingLoad(restaurantId, n));
  if (!picked) return req;

  const [updated] = await db.update(maintenanceRequestsTable).set({
    assignedTo: picked.name,
    status: req.status === "open" ? "in_progress" : req.status,
  }).where(eq(maintenanceRequestsTable.id, requestId)).returning();

  await notifyStaffMember({
    restaurantId,
    staffName: picked.name,
    staffRole: picked.role,
    title: `Maintenance — ${req.location}`,
    message: `${req.title} assigned automatically`,
    metadata: { requestId, module: "maintenance" },
  });

  return updated;
}

function roomServiceRoles(type: string) {
  // Every in-room request is handled by housekeeping (fall back to a manager
  // only when none is on shift — see the assignment below).
  return { roles: ["housekeeping"], food: type === "food" || type === "minibar" };
}

export async function autoAssignRoomServiceRequest(restaurantId: number, requestId: number) {
  const [req] = await db.select().from(roomServiceRequestsTable).where(
    and(eq(roomServiceRequestsTable.id, requestId), eq(roomServiceRequestsTable.restaurantId, restaurantId)),
  );
  if (!req || req.assignedTo) return req;

  const { roles } = roomServiceRoles(req.type);
  let candidates = await activeStaff(restaurantId, roles);
  if (!candidates.length) candidates = await activeStaff(restaurantId, ["manager"]);
  const loadOf = async (n: string) => (await roomServiceLoad(restaurantId, n)) + (await housekeepingLoad(restaurantId, n));
  const picked = await pickLeastLoaded(candidates, loadOf);
  if (!picked) return req;

  // Assigned but not started — housekeeping taps Start in their app.
  const nextStatus = "accepted";
  const [updated] = await db.update(roomServiceRequestsTable).set({
    assignedTo: picked.name,
    status: req.status === "pending" ? nextStatus : req.status,
  }).where(eq(roomServiceRequestsTable.id, requestId)).returning();

  await notifyStaffMember({
    restaurantId,
    staffName: picked.name,
    staffRole: picked.role,
    title: `Room ${req.roomNumber} — ${req.type}`,
    message: "Guest room request assigned — start it in your app",
    metadata: { requestId, roomNumber: req.roomNumber, type: req.type, module: "room_service" },
  });

  broadcastEvent("room_service_assigned", {
    restaurantId,
    requestId,
    roomNumber: req.roomNumber,
    assignedTo: picked.name,
    type: req.type,
  });

  return updated;
}

export async function autoAssignWaiterToOrder(restaurantId: number, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)),
  );
  if (!order || order.waiterName) return order;
  if (order.status !== "ready") return order;

  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const tracking = (typeof meta.tracking === "object" && meta.tracking !== null ? meta.tracking : {}) as Record<string, unknown>;

  // A room order (room number, "Room …" table name, or room_service type) is a
  // housekeeping delivery; a table order is a waiter delivery.
  const isRoomOrder = order.type === "room_service"
    || meta.roomNumber != null
    || /^\s*room\b/i.test(String(order.tableName ?? ""));
  const role = isRoomOrder ? "housekeeping" : "waiter";

  // Room orders go to housekeeping, table orders to a waiter. Fall back to a
  // manager only when no dedicated staff for that role is on shift.
  let candidates = await activeStaff(restaurantId, isRoomOrder ? ["housekeeping"] : ["waiter"]);
  if (!candidates.length) {
    candidates = await activeStaff(restaurantId, ["manager"]);
  }
  const picked = await pickLeastLoaded(candidates, n =>
    isRoomOrder ? housekeepingLoad(restaurantId, n) : waiterLoad(restaurantId, n),
  );
  if (!picked) return order;

  const [updated] = await db.update(ordersTable).set({
    waiterId: picked.id,
    waiterName: picked.name,
    // Keep it "ready" so the assignee taps Start Delivery in their own app.
    status: order.status,
    metadata: {
      ...meta,
      tracking: {
        ...tracking,
        waiterAssignedAt: new Date().toISOString(),
        waiterStatus: "assigned",
        autoAssigned: true,
      },
    },
  }).where(eq(ordersTable.id, orderId)).returning();

  const location = isRoomOrder
    ? (meta.roomNumber ? `Room ${meta.roomNumber}` : (order.tableName || "Room service"))
    : (order.tableName ? `Table ${order.tableName}` : "Table");

  await notifyStaffMember({
    restaurantId,
    staffName: picked.name,
    staffRole: role,
    title: `Order ready — ${location}`,
    message: isRoomOrder
      ? "Kitchen marked order ready — deliver to the room"
      : "Kitchen marked order ready — deliver to guest",
    metadata: { orderId, tableName: order.tableName, roomNumber: meta.roomNumber, module: role },
  });

  broadcastEvent(isRoomOrder ? "housekeeping_assigned" : "waiter_assigned", {
    restaurantId,
    orderId,
    waiterName: picked.name,
    tableName: order.tableName,
    type: order.type,
  });

  return updated;
}
