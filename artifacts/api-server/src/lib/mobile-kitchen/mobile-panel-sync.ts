import { eq, desc } from "drizzle-orm";
import {
  db,
  housekeepingTasksTable,
  maintenanceRequestsTable,
  roomServiceRequestsTable,
  waiterCallsTable,
} from "@workspace/db";
import {
  fetchKitchenOrders,
  KITCHEN_SECTIONS,
  type MappedKitchenOrder,
} from "./kitchen-orders.js";

const now = () => new Date().toISOString();

function hygieneActions(status: string): string[] {
  if (status === "completed" || status === "skipped") return [];
  if (status === "in_progress") return ["complete_checklist", "mark_sanitized"];
  return ["start_task", "complete_checklist"];
}

function maintenanceActions(status: string): string[] {
  if (status === "resolved" || status === "closed") return [];
  if (status === "in_progress") return ["schedule_deep_clean", "verify_staff"];
  return ["start_task", "schedule_deep_clean"];
}

function roomActions(status: string): string[] {
  switch (status) {
    case "pending":
      return ["acknowledge_vip", "start_preparation"];
    case "accepted":
    case "in_progress":
      return ["assign_tray", "mark_delivered"];
    default:
      return [];
  }
}

function itemSummary(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "Guest request";
  return items
    .slice(0, 3)
    .map((item) => {
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name: string }).name);
      }
      return String(item);
    })
    .join(", ");
}

export async function buildHygieneBoardFromDb(restaurantId: number, section: string) {
  const [tasks, maintenance] = await Promise.all([
    db.select().from(housekeepingTasksTable)
      .where(eq(housekeepingTasksTable.restaurantId, restaurantId))
      .orderBy(desc(housekeepingTasksTable.createdAt)),
    db.select().from(maintenanceRequestsTable)
      .where(eq(maintenanceRequestsTable.restaurantId, restaurantId))
      .orderBy(desc(maintenanceRequestsTable.createdAt)),
  ]);

  const matchesSection = (location: string, roomNumber?: string | null) =>
    section === "All" || location.includes(section) || roomNumber === section;

  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && matchesSection(t.location, t.roomNumber),
  );
  const activeMaintenance = maintenance.filter(
    (m) => m.status !== "resolved" && m.status !== "closed" && matchesSection(m.location),
  );

  const cleaningSchedules = activeTasks
    .filter((t) => t.type === "cleaning" || t.type === "linen")
    .map((t) => ({
      id: `HK-${t.id}`,
      taskName: t.title,
      section: t.roomNumber ? `Room ${t.roomNumber}` : t.location,
      frequency: t.isRecurring ? (t.recurringInterval ?? "Daily") : "Once",
      scheduledTime: t.scheduledAt ? new Date(t.scheduledAt).toISOString() : now(),
      assignedStaff: t.assignedTo ?? "Unassigned",
      status: t.status === "pending" ? "scheduled" : t.status,
      availableActions: hygieneActions(t.status),
    }));

  const hygieneChecklists = activeTasks
    .filter((t) => t.type === "inspection")
    .map((t) => ({
      id: `HK-${t.id}`,
      title: t.title,
      section: t.roomNumber ? `Room ${t.roomNumber}` : t.location,
      itemsCompleted: t.status === "in_progress" ? 2 : 0,
      totalItems: 4,
      status: t.status === "completed" ? "completed" : "pending",
      availableActions: hygieneActions(t.status),
    }));

  const deepCleaningJobs = activeMaintenance.map((m) => ({
    id: `MT-${m.id}`,
    areaName: m.title,
    section: m.location,
    scheduledDate: new Date(m.createdAt).toISOString().slice(0, 10),
    assignedTeam: m.assignedTo ?? "Maintenance",
    status: m.status === "open" ? "scheduled" : m.status,
    availableActions: maintenanceActions(m.status),
  }));

  const sanitizationTasks = activeTasks
    .filter((t) => t.type === "cleaning" && t.priority === "urgent")
    .map((t) => ({
      id: `HK-${t.id}`,
      equipmentName: t.title,
      section: t.location,
      lastSanitized: t.status === "completed" ? "Today" : "Due",
      dueInMinutes: t.status === "pending" ? 30 : 0,
      status: t.status === "in_progress" ? "in_progress" : "due",
      availableActions: hygieneActions(t.status),
    }));

  const completedToday = tasks.filter(
    (t) => t.status === "completed" && t.completedAt
      && new Date(t.completedAt).toDateString() === new Date().toDateString(),
  ).length;

  return {
    section,
    lastSyncedAt: now(),
    cleaningSchedules,
    hygieneChecklists,
    sanitizationTasks,
    foodSafetyEntries: [],
    deepCleaningJobs,
    complianceRecords: tasks
      .filter((t) => t.status === "completed")
      .slice(0, 8)
      .map((t) => ({
        id: `HK-${t.id}`,
        recordType: t.type,
        title: t.title,
        section: t.location,
        lastUpdated: t.completedAt ? new Date(t.completedAt).toISOString() : now(),
        status: "compliant",
        availableActions: [] as string[],
      })),
    stats: {
      scheduledTasks: cleaningSchedules.length,
      checklistsOpen: hygieneChecklists.length,
      sanitizationDue: sanitizationTasks.length,
      foodSafetyAlerts: 0,
      deepCleanPending: deepCleaningJobs.length,
      complianceIssues: 0,
      completedToday,
    },
    hygieneFeatures: {
      cleaningSchedules: true,
      hygieneChecklists: true,
      equipmentSanitization: true,
      foodSafetyTracking: true,
      deepCleaningManagement: true,
      fssaiSopTracking: true,
      hygieneAuditLogs: true,
      staffHygieneVerification: true,
    },
    sections: KITCHEN_SECTIONS,
  };
}

export async function buildRoomServiceBoardFromDb(
  restaurantId: number,
  section: string,
  orders: MappedKitchenOrder[],
) {
  const requests = await db.select().from(roomServiceRequestsTable)
    .where(eq(roomServiceRequestsTable.restaurantId, restaurantId))
    .orderBy(desc(roomServiceRequestsTable.createdAt));

  const activeRequests = requests.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled",
  );

  const kitchenRoomOrders = orders
    .filter((o) => o.roomNumber)
    .map((o) => ({
      id: `RS-ORD-${o.id}`,
      orderId: o.id,
      kotNumber: o.kotNumber,
      roomNumber: o.roomNumber!,
      section: o.section,
      guestType: o.vip ? "vip" : "standard",
      itemSummary: o.items.map((i) => i.name).join(", ") || "Room order",
      status: o.status === "ready" ? "ready" : o.status === "serving" ? "delivering" : "preparing",
      priority: o.vip ? "vip" : "normal",
      timerSeconds: 0,
      timerLabel: o.status,
      availableActions: roomActions(o.status === "ready" ? "accepted" : "in_progress"),
    }));

  const dbRoomOrders = activeRequests.map((r) => ({
    id: `RS-${r.id}`,
    orderId: String(r.id),
    kotNumber: `RS-${r.id}`,
    roomNumber: r.roomNumber,
    section: "Floor",
    guestType: r.type === "food" ? "standard" : r.type,
    itemSummary: itemSummary(r.items) || r.notes || r.type,
    status: r.status === "accepted" ? "preparing" : r.status,
    priority: r.type === "food" ? "normal" : "high",
    timerSeconds: (r.estimatedTime ?? 30) * 60,
    timerLabel: `${r.estimatedTime ?? 30} min`,
    availableActions: roomActions(r.status),
  }));

  const roomOrders = [...dbRoomOrders, ...kitchenRoomOrders];
  const filtered = section === "All"
    ? roomOrders
    : roomOrders.filter((o) => o.section === section);

  const vipRoomAlerts = filtered
    .filter((o) => o.guestType === "vip" || o.priority === "vip")
    .map((o) => ({
      id: `VIP-${o.id}`,
      roomNumber: o.roomNumber,
      guestName: "VIP Guest",
      alertType: "priority",
      priority: "vip",
      status: "active",
    }));

  const scheduledDeliveries = activeRequests
    .filter((r) => r.type === "food")
    .map((r) => ({
      id: `SCH-${r.id}`,
      orderId: String(r.id),
      kotNumber: `RS-${r.id}`,
      roomNumber: r.roomNumber,
      scheduledTime: new Date(r.createdAt).toISOString(),
      itemSummary: itemSummary(r.items) || r.notes || r.type,
      status: r.status,
    }));

  const trayAssignments = activeRequests
    .filter((r) => r.assignedTo)
    .map((r) => ({
      id: `TRAY-${r.id}`,
      trayId: `TRAY-${r.id}`,
      roomNumber: r.roomNumber,
      orderId: String(r.id),
      kotNumber: `RS-${r.id}`,
      staffName: r.assignedTo!,
      status: r.status,
    }));

  return {
    section,
    lastSyncedAt: now(),
    roomOrders: filtered,
    vipRoomAlerts,
    scheduledDeliveries,
    trayAssignments,
    miniBarSync: [],
    stats: {
      activeRoomOrders: filtered.filter(
        (o) => o.status !== "completed" && o.status !== "delivered",
      ).length,
      vipRooms: vipRoomAlerts.length,
      scheduledDeliveries: scheduledDeliveries.length,
      traysInTransit: trayAssignments.filter(
        (t) => t.status === "in_progress" || t.status === "delivering",
      ).length,
      miniBarPending: 0,
      completedToday: requests.filter((r) => r.status === "completed").length,
    },
    roomServiceFeatures: {
      roomWiseOrderTracking: true,
      vipRoomPriority: true,
      scheduledRoomDelivery: true,
      trayManagement: true,
      miniBarSynchronization: true,
    },
    sections: KITCHEN_SECTIONS,
  };
}

export async function buildWaiterBoardFromDb(
  restaurantId: number,
  section: string,
  orders: MappedKitchenOrder[],
) {
  const ready = orders.filter(
    (o) => o.status === "ready" || o.status === "serving",
  );
  const calls = await db.select().from(waiterCallsTable)
    .where(eq(waiterCallsTable.restaurantId, restaurantId))
    .orderBy(desc(waiterCallsTable.createdAt));

  const openCalls = calls.filter((c) => !c.isResolved);

  const waiterLoads = new Map<string, number>();
  for (const o of ready) {
    if (o.waiterName) {
      waiterLoads.set(o.waiterName, (waiterLoads.get(o.waiterName) ?? 0) + 1);
    }
  }

  const workloadBoard = [...waiterLoads.entries()].map(([waiterName], idx) => ({
    waiterId: `W-${idx + 1}`,
    waiterName,
    activeTasks: waiterLoads.get(waiterName) ?? 0,
    completedToday: 0,
    loadScore: Math.min(1, (waiterLoads.get(waiterName) ?? 0) / 4),
    status: (waiterLoads.get(waiterName) ?? 0) > 3 ? "busy" : "balanced",
  }));

  const orderNotifications = ready.map((o) => ({
    id: `WRN-${o.id}`,
    title: `Order Ready – ${o.location}`,
    body: o.waiterName
      ? `${o.kotNumber} → ${o.waiterName}`
      : `${o.kotNumber} is ready`,
    tableNumber: o.tableNumber ?? "—",
    status: o.waiterName ? "assigned" : "new",
    createdAt: now(),
    availableActions: ["acknowledge", "start_delivery"],
  }));

  const callNotifications = openCalls.map((c) => ({
    id: `CALL-${c.id}`,
    title: `Table call – ${c.tableName ?? "Guest"}`,
    body: c.message ?? `Guest requested ${c.type}`,
    tableNumber: c.tableName ?? "—",
    status: "new",
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : now(),
    availableActions: ["acknowledge", "resolve_call"],
  }));

  return {
    filterSection: section,
    lastSyncedAt: now(),
    tasks: ready.map((o) => ({
      id: `WT-${o.id}`,
      orderId: o.id,
      kotNumber: o.kotNumber,
      tableNumber: o.tableNumber ?? "—",
      roomNumber: o.roomNumber ?? null,
      assignedWaiter: o.waiterName ?? "Auto-assigning…",
      status: o.status === "serving" ? "delivering" : "ready",
      priority: o.vip ? "vip" : "normal",
      message: o.waiterName ? `Assigned to ${o.waiterName}` : "Ready for pickup",
      availableActions: o.waiterName
        ? ["start_delivery", "confirm_delivery"]
        : ["assign", "start_delivery", "confirm_delivery"],
    })),
    notifications: [...callNotifications, ...orderNotifications],
    workloadBoard: workloadBoard.length ? workloadBoard : [{
      waiterId: "W-0",
      waiterName: "No active waiters",
      activeTasks: 0,
      completedToday: 0,
      loadScore: 0,
      status: "balanced",
    }],
    stats: {
      openTasks: ready.length,
      readyNotifications: ready.filter((o) => !o.waiterName).length + openCalls.length,
      deliveriesConfirmedToday: ready.filter((o) => o.status === "serving").length,
      autoAssignmentsToday: ready.filter((o) => o.waiterName).length,
      balancedWaiters: workloadBoard.length,
    },
    featureFlags: {
      autoTaskAllocation: true,
      orderReadyNotifications: true,
      deliveryConfirmation: true,
      workloadBalanceAlgorithm: true,
      inHotelNavigation: true,
      noManualCalling: true,
    },
  };
}
