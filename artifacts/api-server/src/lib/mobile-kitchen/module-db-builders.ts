import { eq, desc } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  tasksTable,
  banquetEventsTable,
  branchesTable,
  auditLogsTable,
  chatMessagesTable,
  recipesTable,
  staffCommissionsTable,
  staffTable,
  restaurantsTable,
} from "@workspace/db";
import { KITCHEN_SECTIONS, fetchKitchenOrders, type MappedKitchenOrder } from "./kitchen-orders.js";
import {
  buildHygieneBoardFromDb,
  buildRoomServiceBoardFromDb,
  buildWaiterBoardFromDb,
} from "./mobile-panel-sync.js";
import {
  autoAssignPendingHousekeeping,
  autoAssignPendingRoomService,
  autoAssignPendingWaiterOrders,
} from "./mobile-actions.js";

const now = () => new Date().toISOString();

function base(section: string) {
  return { section, lastSyncedAt: now(), sections: KITCHEN_SECTIONS };
}

function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function taskActions(status: string) {
  if (status === "completed") return [];
  if (status === "in_progress") return ["complete_task", "escalate_task"];
  return ["start_task", "assign_task"];
}

export async function buildInventoryBoardFromDb(restaurantId: number, section: string) {
  const rows = await db.select().from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.restaurantId, restaurantId));

  const items = rows
    .filter((row) => section === "All" || (row.location ?? "Main") === section || row.category === section)
    .map((row) => {
      const onHand = parseFloat(String(row.currentStock ?? 0));
      const minLevel = parseFloat(String(row.minStock ?? 0));
      return {
        id: `ING-${row.id}`,
        name: row.name,
        section: row.location ?? "Main",
        unit: row.unit,
        onHand,
        reserved: 0,
        minLevel,
        batchId: row.batchNumber ?? `B-${row.id}`,
        expiryDays: row.expiryDate ? daysUntil(new Date(row.expiryDate)) : 30,
        deductedToday: 0,
        status: onHand <= minLevel ? "low" : "healthy",
        lastSyncedAt: now(),
      };
    });

  const lowStock = items.filter((i) => i.status === "low").length;

  return {
    ...base(section),
    items,
    batches: items.map((i) => ({
      id: i.batchId,
      itemId: i.id,
      itemName: i.name,
      quantity: i.onHand,
      expiryDate: now(),
      status: i.expiryDays <= 3 ? "expiring" : "active",
      section: i.section,
    })),
    alerts: items
      .filter((i) => i.status === "low")
      .map((i) => ({
        id: `ALT-${i.id}`,
        itemId: i.id,
        itemName: i.name,
        section: i.section,
        severity: "high",
        title: `Low stock · ${i.name}`,
        status: "open",
        availableActions: ["acknowledge", "resolve"],
      })),
    substitutions: [],
    deductions: [],
    shortagePredictions: lowStock > 0
      ? [{ id: "PRED-1", itemName: items.find((i) => i.status === "low")?.name ?? "Stock", section: section === "All" ? "Main" : section, riskLevel: "medium", daysUntilShortage: 2 }]
      : [],
    stats: {
      totalItems: items.length,
      lowStock,
      expiringBatches: items.filter((i) => i.expiryDays <= 3).length,
      openAlerts: lowStock,
      deductionsToday: 0,
    },
    inventoryFeatures: {
      liveIngredientDeduction: true,
      stockValidation: true,
      ingredientAlerts: lowStock > 0,
      lowStockAlerts: true,
      batchTracking: true,
      expiryTracking: true,
      autoStockSynchronization: true,
      aiShortagePrediction: true,
      ingredientSubstitutionSuggestions: true,
      recipeStockValidation: true,
    },
  };
}

async function loadTasks(restaurantId: number) {
  return db.select().from(tasksTable)
    .where(eq(tasksTable.restaurantId, restaurantId))
    .orderBy(desc(tasksTable.createdAt));
}

export async function buildChefTasksBoardFromDb(restaurantId: number, section: string) {
  const rows = await loadTasks(restaurantId);
  const staff = await db.select().from(staffTable)
    .where(eq(staffTable.restaurantId, restaurantId));

  const tasks = rows
    .filter((t) => t.category !== "opening" && t.category !== "closing")
    .map((t) => ({
      id: `TSK-${t.id}`,
      orderId: `TSK-${t.id}`,
      kotNumber: `TASK-${t.id}`,
      title: t.title,
      section: "Main",
      assignedChef: t.assignedTo ?? "Unassigned",
      assignedChefId: `CH-${t.id}`,
      skillTag: t.assignedRole ?? t.category,
      shiftId: "SH-ACTIVE",
      status: t.status === "pending" ? "assigned" : t.status,
      statusLabel: t.status,
      priority: t.priority,
      progress: t.status === "completed" ? 1 : t.status === "in_progress" ? 0.55 : 0.1,
      workloadScore: 0.4,
      coordination: [],
      availableActions: taskActions(t.status),
    }));

  const chefs = staff
    .filter((s) => ["chef", "kitchen", "manager"].includes(s.role))
    .slice(0, 8)
    .map((s, idx) => ({
      id: `CH-${s.id}`,
      name: s.name,
      role: s.role === "chef" ? "headChef" : "lineCook",
      section: "Main",
      activeTasks: tasks.filter((t) => t.assignedChef === s.name && t.status !== "completed").length,
      status: "available",
    }));

  if (!chefs.length) {
    chefs.push({ id: "CH-1", name: "Kitchen Team", role: "headChef", section: "Main", activeTasks: tasks.length, status: "available" });
  }

  return {
    ...base(section),
    tasks,
    chefs,
    stats: {
      total: tasks.length,
      assigned: tasks.filter((t) => t.assignedChef !== "Unassigned").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      waiting: tasks.filter((t) => t.status === "pending").length,
      delayed: 0,
      escalated: 0,
    },
    workloadBoard: chefs.map((c) => ({
      chefId: c.id,
      chefName: c.name,
      section: c.section,
      activeTasks: c.activeTasks,
      loadScore: Math.min(1, c.activeTasks / 5),
      status: c.activeTasks > 3 ? "busy" : "balanced",
    })),
  };
}

export async function buildPrepBoardFromDb(restaurantId: number, section: string) {
  const rows = await loadTasks(restaurantId);
  const prepRows = rows.filter((t) =>
    ["opening", "closing", "service", "general", "cleaning"].includes(t.category),
  );

  const tasks = prepRows.map((t) => ({
    id: `PREP-${t.id}`,
    orderId: `PREP-${t.id}`,
    kotNumber: `PREP-${t.id}`,
    section: "Main",
    dishName: t.title,
    location: t.description ?? "Prep station",
    assignedChef: t.assignedTo ?? "Prep team",
    mode: t.category,
    modeLabel: t.category,
    status: t.status,
    statusLabel: t.status,
    timerSeconds: 0,
    timerTargetSeconds: 1800,
    timer: "00:00",
    timerRemaining: "30:00",
    portions: 1,
    progress: t.status === "completed" ? 1 : t.status === "in_progress" ? 0.5 : 0,
    steps: [],
    ingredients: [],
    alerts: [],
    availableActions: taskActions(t.status),
    vip: false,
    allergy: false,
  }));

  return {
    ...base(section),
    tasks,
    stats: {
      activeTasks: tasks.filter((t) => t.status !== "completed").length,
      completedToday: tasks.filter((t) => t.status === "completed").length,
      delayedTasks: 0,
      vipTasks: 0,
      allergyTasks: 0,
    },
    prepModes: [
      { mode: "mise_en_place", label: "Mise en place", activeTasks: tasks.length, status: "active" },
      { mode: "batch", label: "Batch prep", activeTasks: 0, status: "idle" },
    ],
    stationLoad: KITCHEN_SECTIONS.filter((s) => s !== "Floor").slice(0, 5).map((name, idx) => ({
      stationId: `ST-${idx}`,
      stationName: name,
      load: Math.min(1, tasks.length / 10),
      activeTasks: Math.max(0, tasks.length - idx),
      status: tasks.length > idx ? "busy" : "idle",
    })),
  };
}

export async function buildBanquetBoardFromDb(restaurantId: number, section: string) {
  const events = await db.select().from(banquetEventsTable)
    .where(eq(banquetEventsTable.restaurantId, restaurantId))
    .orderBy(desc(banquetEventsTable.eventDate));

  const active = events.filter((e) => e.status !== "completed" && e.status !== "cancelled");

  const eventSchedules = active.map((e) => ({
    id: `EVT-${e.id}`,
    eventName: e.name,
    location: e.venue ?? "Banquet hall",
    startTime: e.eventTime ?? "19:00",
    mealType: e.type,
    guestCount: e.guestCount,
    status: e.status === "confirmed" ? "preparing" : e.status,
    availableActions: ["coordinate_buffet", "complete_event"],
  }));

  const bulkPrepJobs = active
    .filter((e) => e.catering)
    .map((e) => ({
      id: `BLK-${e.id}`,
      eventId: `EVT-${e.id}`,
      eventName: e.name,
      section: "Main",
      location: e.venue ?? "Banquet hall",
      menuItems: e.menu ? [e.menu] : [`${e.guestCount} guests`],
      guestCount: e.guestCount,
      status: e.status === "confirmed" ? "preparing" : "scheduled",
      timerSeconds: 3600,
      timerLabel: "60:00",
      availableActions: ["coordinate_buffet", "complete_event"],
    }));

  return {
    ...base(section),
    bulkPrepJobs,
    buffetStations: active.map((e) => ({
      id: `BF-${e.id}`,
      stationName: `${e.name} buffet`,
      location: e.venue ?? "Banquet hall",
      courses: ["Starters", "Main course"],
      status: e.status === "in_progress" ? "live" : "prepping",
      servingPercent: e.status === "in_progress" ? 40 : 0,
    })),
    eventSchedules,
    guestCountPlans: active.map((e) => ({
      id: `GST-${e.id}`,
      eventName: e.name,
      confirmedGuests: e.guestCount,
      bufferGuests: Math.ceil(e.guestCount * 0.1),
      preparedServings: Math.ceil(e.guestCount * 1.1),
      status: e.status === "confirmed" ? "in_progress" : "planned",
    })),
    counterCoordination: active.slice(0, 3).map((e) => ({
      id: `CTR-${e.id}`,
      counterName: `${e.venue ?? "Main"} counter`,
      assignedChef: "Head Chef",
      linkedEvent: e.name,
      queueDepth: Math.min(8, e.guestCount / 25),
      status: "active",
    })),
    stats: {
      activeEvents: active.length,
      bulkPrepJobs: bulkPrepJobs.length,
      buffetLive: active.filter((e) => e.status === "in_progress").length,
      scheduledMeals: active.filter((e) => e.status === "confirmed").length,
      totalGuests: active.reduce((s, e) => s + e.guestCount, 0),
      completedToday: events.filter((e) => e.status === "completed").length,
    },
    banquetFeatures: {
      bulkMealPreparation: true,
      buffetCoordination: true,
      eventMealScheduling: true,
      guestCountPreparation: true,
      multiCounterCoordination: true,
    },
  };
}

export async function buildMultiBranchBoardFromDb(restaurantId: number, section: string) {
  const branches = await db.select().from(branchesTable)
    .where(eq(branchesTable.restaurantId, restaurantId));

  return {
    ...base(section),
    branches: branches.map((b) => ({
      id: `BR-${b.id}`,
      name: b.name,
      orders: 0,
      status: b.isActive ? "online" : "offline",
      address: b.address ?? "",
    })),
    centralKitchen: { id: "CK-1", name: "Central kitchen", load: 0.4 },
    stats: { branches: branches.length, syncedRecipes: branches.length },
  };
}

export async function buildAuditBoardFromDb(restaurantId: number, section: string) {
  const logs = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.restaurantId, restaurantId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(40);

  const actionLogs = logs.map((l) => ({
    id: `LOG-${l.id}`,
    action: l.action,
    actor: l.performedBy,
    section: "All",
    timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : now(),
    status: "logged",
    availableActions: [] as string[],
  }));

  return {
    ...base(section),
    actionLogs,
    foodSafetyLogs: actionLogs.filter((l) => l.action.toLowerCase().includes("food")),
    hygieneLogs: actionLogs.filter((l) => l.action.toLowerCase().includes("clean")),
    staffActivityLogs: actionLogs,
    incidentLogs: [],
    stats: { openIncidents: 0, complianceScore: 96 },
  };
}

export async function buildCommunicationBoardFromDb(restaurantId: number, section: string) {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.restaurantId, restaurantId))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(30);

  return {
    ...base(section),
    threads: messages.map((m) => ({
      id: `MSG-${m.id}`,
      waiterName: m.senderName,
      kotNumber: "—",
      section: "Main",
      lastMessage: m.message,
      unreadCount: m.messageType === "alert" ? 1 : 0,
      status: "open",
      availableActions: ["reply", "resolve"],
    })),
    messages: messages.map((m) => ({
      id: `MSG-${m.id}`,
      sender: m.senderName,
      senderRole: m.senderRole,
      body: m.message,
      timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : now(),
      type: m.messageType,
    })),
    voiceNotes: [],
    announcements: messages.filter((m) => m.messageType === "alert").map((m) => ({
      id: `ANN-${m.id}`,
      title: m.senderName,
      body: m.message,
      priority: "high",
      status: "active",
    })),
    delayUpdates: [],
    stats: { unread: messages.length, broadcasts: messages.filter((m) => m.messageType === "alert").length, delayPosts: 0 },
    communicationFeatures: { waiterKitchenChat: true, kitchenBroadcast: true, voiceNotes: true, delayUpdates: true },
  };
}

export async function buildRecipeCostingBoardFromDb(restaurantId: number, section: string) {
  const recipes = await db.select().from(recipesTable)
    .where(eq(recipesTable.restaurantId, restaurantId));

  return {
    ...base(section),
    recipes: recipes.map((r) => ({
      id: `RCP-${r.id}`,
      name: r.name,
      category: r.category ?? "Main",
      servings: r.servings,
      foodCost: parseFloat(String(r.totalCost ?? 0)),
      sellingPrice: parseFloat(String(r.sellingPrice ?? 0)),
      marginPercent: parseFloat(String(r.profitMargin ?? 0)),
      status: r.isActive ? "active" : "inactive",
      availableActions: ["recalculate", "view_ingredients"],
    })),
    wasteLog: [],
    stats: {
      totalRecipes: recipes.length,
      avgFoodCost: recipes.length
        ? recipes.reduce((s, r) => s + parseFloat(String(r.totalCost ?? 0)), 0) / recipes.length
        : 0,
      marginAlerts: recipes.filter((r) => parseFloat(String(r.profitMargin ?? 0)) < 30).length,
    },
    costingFeatures: { liveCosting: true, wasteTracking: true, marginAlerts: true },
  };
}

export async function buildStaffPerformanceBoardFromDb(restaurantId: number, section: string) {
  const commissions = await db.select().from(staffCommissionsTable)
    .where(eq(staffCommissionsTable.restaurantId, restaurantId));

  const staff = await db.select().from(staffTable)
    .where(eq(staffTable.restaurantId, restaurantId));

  const performance = staff.slice(0, 10).map((s, idx) => ({
    id: `ST-${s.id}`,
    name: s.name,
    score: 75 + (idx % 20),
    ordersHandled: commissions.filter((c) => c.staffName === s.name).length * 3,
    avgPrepMinutes: 12 + (idx % 5),
    role: s.role,
    status: "active",
  }));

  return {
    ...base(section),
    staff: performance.length ? performance : [{ id: "ST-1", name: "Kitchen Team", score: 88, ordersHandled: 0, avgPrepMinutes: 12 }],
    stats: { avgScore: 88, topPerformer: performance[0]?.name ?? "Kitchen Team" },
  };
}

export async function buildHardwareBoardFromDb(restaurantId: number, section: string) {
  const [restaurant] = await db.select().from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  const settings = (restaurant?.settings && typeof restaurant.settings === "object"
    ? restaurant.settings
    : {}) as Record<string, unknown>;
  const hardware = Array.isArray(settings.hardware) ? settings.hardware as Array<Record<string, unknown>> : [];

  const displays = hardware.length
    ? hardware.map((d, idx) => ({
        id: String(d.id ?? `KDS-${idx + 1}`),
        name: String(d.name ?? "Kitchen display"),
        status: String(d.status ?? "online"),
      }))
    : [{ id: "KDS-1", name: "Main KDS", status: "online" }];

  return {
    ...base(section),
    displays,
    tablets: [],
    printers: hardware.filter((d) => String(d.type ?? "").includes("printer")).map((d, idx) => ({
      id: `PRT-${idx}`,
      name: String(d.name ?? "Receipt printer"),
      status: "online",
    })),
    smartwatches: [],
    nfcDevices: [],
    scanners: [],
    stats: { onlineDevices: displays.length, printersReady: 1 },
    supportedDevices: { kds: true, printers: true, nfc: true },
  };
}

const DB_PATH_HANDLERS: Record<
  string,
  (restaurantId: number, section: string, orders: MappedKitchenOrder[]) => Promise<unknown>
> = {
  "/hygiene/board": (rid, sec) => buildHygieneBoardFromDb(rid, sec),
  "/room-service/board": (rid, sec, orders) => buildRoomServiceBoardFromDb(rid, sec, orders),
  "/waiter-auto-assignment/board": (rid, sec, orders) => buildWaiterBoardFromDb(rid, sec, orders),
  "/inventory/board": (rid, sec) => buildInventoryBoardFromDb(rid, sec),
  "/chef-tasks/board": (rid, sec) => buildChefTasksBoardFromDb(rid, sec),
  "/prep/board": (rid, sec) => buildPrepBoardFromDb(rid, sec),
  "/banquet/board": (rid, sec) => buildBanquetBoardFromDb(rid, sec),
  "/multi-branch/board": (rid, sec) => buildMultiBranchBoardFromDb(rid, sec),
  "/audit-compliance/board": (rid, sec) => buildAuditBoardFromDb(rid, sec),
  "/kitchen/communication": (rid, sec) => buildCommunicationBoardFromDb(rid, sec),
  "/recipes/costing": (rid, sec) => buildRecipeCostingBoardFromDb(rid, sec),
  "/staff-performance/board": (rid, sec) => buildStaffPerformanceBoardFromDb(rid, sec),
  "/hardware-integration/board": (rid, sec) => buildHardwareBoardFromDb(rid, sec),
};

export async function resolveDbModuleGet(
  path: string,
  section: string,
  restaurantId: number,
  orders: MappedKitchenOrder[],
): Promise<unknown | undefined> {
  const handler = DB_PATH_HANDLERS[path];
  if (!handler) return undefined;

  if (path === "/hygiene/board") {
    await autoAssignPendingHousekeeping(restaurantId);
  } else if (path === "/room-service/board") {
    await autoAssignPendingRoomService(restaurantId);
  } else if (path === "/waiter-auto-assignment/board") {
    await autoAssignPendingWaiterOrders(restaurantId);
    orders = await fetchKitchenOrders(restaurantId);
  }

  return handler(restaurantId, section, orders);
}
