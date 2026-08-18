import {
  KITCHEN_SECTIONS,
  fetchKitchenOrders,
  getDashboard,
  getKds,
  getProcessing,
  getLiveAlerts,
  type MappedKitchenOrder,
} from "./kitchen-orders.js";
import { resolveDbModuleGet } from "./module-db-builders.js";

const now = () => new Date().toISOString();

const SECTION_META = [
  { id: "main", name: "Main", label: "Main Kitchen", headChef: "Chef Ravi", capacity: 12, iconKey: "main" },
  { id: "tandoor", name: "Tandoor", label: "Tandoor", headChef: "Ravi Tandoor", capacity: 8, iconKey: "tandoor" },
  { id: "chinese", name: "Chinese", label: "Chinese Wok", headChef: "Mei Lin", capacity: 8, iconKey: "chinese" },
  { id: "beverage", name: "Beverage", label: "Beverage Bar", headChef: "Anita Beverage", capacity: 6, iconKey: "beverage" },
  { id: "bar", name: "Bar", label: "Bar", headChef: "Bar Captain", capacity: 6, iconKey: "bar" },
  { id: "dessert", name: "Dessert", label: "Dessert", headChef: "Sara Dessert", capacity: 5, iconKey: "dessert" },
  { id: "bakery", name: "Bakery", label: "Bakery", headChef: "Bakery Lead", capacity: 5, iconKey: "bakery" },
];

const ACTIVE = new Set(["new", "accepted", "preparing", "delayed", "ready", "re_fire", "on_hold"]);

function base(section: string) {
  return { section, lastSyncedAt: now(), sections: KITCHEN_SECTIONS };
}

function buildSectionOverview(section: string, orders: MappedKitchenOrder[]) {
  const sections = SECTION_META.map(meta => {
    const sectionOrders = orders.filter(o => ACTIVE.has(o.status) && o.section === meta.name);
    const count = sectionOrders.length;
    const load = Math.min(1.2, count / meta.capacity);
    const delayed = sectionOrders.filter(o => o.status === "delayed").length;
    return {
      id: meta.id,
      name: meta.name,
      label: meta.label,
      headChef: meta.headChef,
      capacity: meta.capacity,
      activeOrders: count,
      queueDepth: count,
      load,
      staffAssigned: count > 4 ? 3 : count > 0 ? 2 : 1,
      delayedOrders: delayed,
      status: load > 0.85 ? "critical" : load > 0.55 ? "rush" : "normal",
      isOnline: true,
      iconKey: meta.iconKey,
      parallelPrep: count > 2,
    };
  }).sort((a, b) => b.load - a.load);

  return {
    filterSection: section,
    sections,
    lastSyncedAt: now(),
    stats: {
      totalSections: sections.length,
      onlineSections: sections.length,
      busiestSection: sections[0]?.name ?? "Main",
      avgLoad: sections.length
        ? sections.reduce((s, x) => s + x.load, 0) / sections.length
        : 0,
    },
  };
}

function buildRoutingBoard() {
  return {
    splitOrders: [],
    recommendations: [{
      id: "REC-stable",
      title: "Queue optimization",
      message: "Sections synced with live panel orders",
      action: "optimize",
      targetSection: "Main",
      severity: "info",
    }],
    routingLog: [{
      time: now(),
      message: "Live sync from restaurant panel",
      type: "sync",
    }],
    smartRouting: {
      autoSectionAssignment: true,
      multiSectionSplitting: true,
      parallelPreparation: true,
      aiLoadBalancing: true,
      smartChefAllocation: true,
      queueOptimization: true,
    },
  };
}

function ordersFromKitchen(orders: MappedKitchenOrder[]) {
  return orders.filter(o => ACTIVE.has(o.status));
}

function inventorySnapshot(section: string) {
  // Fallback only when DB module is unavailable — return empty, not hardcoded demo items.
  return emptyBoardSnapshot(section, {
    items: [],
    batches: [],
    alerts: [],
    substitutions: [],
    deductions: [],
    shortagePredictions: [],
    stats: { totalItems: 0, lowStock: 0, expiringBatches: 0, openAlerts: 0, deductionsToday: 0 },
    inventoryFeatures: {
      liveIngredientDeduction: true, stockValidation: true, ingredientAlerts: false, lowStockAlerts: true,
      batchTracking: true, expiryTracking: true, autoStockSynchronization: true, aiShortagePrediction: true,
      ingredientSubstitutionSuggestions: false, recipeStockValidation: true,
    },
    summary: { status: "connected", source: "restaurant-panel" },
  });
}

function aiAssistantSnapshot(section: string, orders: MappedKitchenOrder[]) {
  const active = ordersFromKitchen(orders);
  const delayed = active.filter(o => o.status === "delayed").length;
  return {
    ...base(section),
    predictions: { rushInMinutes: 25, delayRiskOrders: delayed, recommendedChef: "Kitchen Team", prepOptimizationScore: 0.82 },
    suggestions: delayed > 0 ? [{
      id: "SUG-DELAY", title: "Delay recovery", message: `${delayed} orders need priority`, impact: "high", action: "reprioritize",
    }] : [],
    insights: [{ id: "INS-1", title: "Live panel sync", message: `${active.length} active kitchen orders`, severity: "info" }],
    voiceCommands: [
      { id: "VC-1", command: "mark_ready", label: "Mark order ready", enabled: active.length > 0 },
      { id: "VC-2", command: "delay_5", label: "Delay 5 minutes", enabled: true },
    ],
    stats: { activeSuggestions: delayed > 0 ? 1 : 0, highImpact: delayed > 0 ? 1 : 0, insights: 1, voiceCommands: 2 },
    featureFlags: {
      smartPreparationSuggestions: true, delayPrediction: delayed > 0, rushPrediction: active.length > 8,
      smartCookingSequence: true, smartChefAllocation: true, ingredientOptimization: true,
      aiWorkloadBalancing: true, preparationOptimization: true,
    },
  };
}

function emptyBoardSnapshot(section: string, extra: Record<string, unknown> = {}) {
  return {
    ...base(section),
    board: [],
    items: [],
    tasks: [],
    orders: [],
    alerts: [],
    stats: { total: 0, active: 0, resolved: 0, pending: 0 },
    summary: { status: "connected", source: "fastap-panel" },
    ...extra,
  };
}

const PATH_BUILDERS: Record<string, (section: string, orders: MappedKitchenOrder[]) => unknown> = {
  "/firing/sessions": (section) => ({
    ...base(section),
    sessions: [],
    stats: { totalSessions: 0, activeFires: 0, heldCourses: 0, vipSessions: 0, syncAlerts: 0 },
    smartFiring: { tablePacing: true, guestPacing: false, delaySynchronization: false, multiCourseCoordination: false },
    coordinationBoard: [],
  }),
  "/prep/board": (section) => ({
    ...base(section),
    tasks: [],
    stats: { total: 0, active: 0, paused: 0, pending: 0, alerts: 0 },
    prepModes: [],
    stationLoad: [],
  }),
  "/modifiers/board": (section, orders) => ({
    ...base(section),
    orders: ordersFromKitchen(orders).map(o => ({
      id: o.id, kotNumber: o.kotNumber, section: o.section, location: o.location,
      modifiers: o.modifiers, allergy: o.allergy, vip: o.vip,
      stats: { totalModifiers: o.modifiers.length, pendingAcknowledgment: 0, pendingChefConfirm: 0, flashAlerts: o.allergy ? 1 : 0 },
      availableActions: ["acknowledge", "confirm"],
    })),
    catalog: [{ label: "Extra spicy", type: "spice" }, { label: "No onion", type: "allergy" }],
    stats: { totalOrders: orders.length, pendingAck: 0, pendingChef: 0, flashAlerts: 0, allergyOrders: orders.filter(o => o.allergy).length },
    smartAlerts: { allergyFlash: orders.some(o => o.allergy), vipModifiers: orders.some(o => o.vip), autoAcknowledge: false },
  }),
  "/safety/board": (section, orders) => ({
    ...base(section),
    cases: orders.filter(o => o.allergy).map(o => ({
      id: `CASE-${o.id}`, orderId: o.id, kotNumber: o.kotNumber, section: o.section,
      severity: "high", allergen: "Guest allergy", status: "open",
      availableActions: ["acknowledge", "escalate", "resolve"],
    })),
    stats: { openCases: orders.filter(o => o.allergy).length, critical: 0, resolvedToday: 0 },
    safetyFeatures: { allergyAlerts: true, crossContamination: true, ingredientTrace: true },
  }),
  "/chef-tasks/board": (section) => ({
    ...base(section),
    tasks: [], chefs: [{ id: "CH-1", name: "Kitchen Team", role: "headChef", section: "Main", activeTasks: 0, status: "available" }],
    stats: { total: 0, assigned: 0, inProgress: 0, waiting: 0, delayed: 0, escalated: 0 },
    workloadBoard: [],
  }),
  "/ai/assistant": aiAssistantSnapshot,
  "/orders/priority": (section, orders) => ({
    ...base(section),
    queue: ordersFromKitchen(orders).map((o, i) => ({
      id: o.id, kotNumber: o.kotNumber, priority: o.priority, sortOrder: i + 1,
      section: o.section, status: o.status, vip: o.vip,
    })),
    stats: { total: orders.length, vip: orders.filter(o => o.vip).length, express: orders.filter(o => o.priority === "express").length },
    priorityEngine: { aiReprioritize: true, vipLane: true, expressBoost: true },
  }),
  "/kitchen/communication": (section) => ({
    ...base(section),
    messages: [], voiceNotes: [], announcements: [], delayUpdates: [],
    stats: { unread: 0, broadcasts: 0, delayPosts: 0 },
    communicationFeatures: { kitchenBroadcast: true, voiceNotes: true, delayUpdates: true },
  }),
  "/inventory/board": inventorySnapshot,
  "/recipes/costing": (section) => ({
    ...base(section),
    recipes: [], wasteLog: [],
    stats: { totalRecipes: 0, avgFoodCost: 0, marginAlerts: 0 },
    costingFeatures: { liveCosting: true, wasteTracking: true, marginAlerts: false },
  }),
  "/prep/stations": (section) => ({
    ...base(section),
    stations: SECTION_META.map(m => ({
      id: m.id, name: m.name, chef: m.headChef, load: 0, activeTasks: 0, status: "idle",
    })),
    stats: { totalStations: SECTION_META.length, busy: 0, idle: SECTION_META.length },
  }),
  "/batch/cooking": (section) => ({
    ...base(section),
    batches: [], forecast: [],
    stats: { activeBatches: 0, completedToday: 0, forecastItems: 0 },
    batchFeatures: { batchPlanning: true, productionForecast: true },
  }),
  "/delays/board": (section, orders) => ({
    ...base(section),
    delays: orders.filter(o => o.status === "delayed").map(o => ({
      id: o.id, kotNumber: o.kotNumber, section: o.section, timerSeconds: o.timerSeconds,
      reason: "Kitchen backlog", severity: "high", availableActions: ["escalate", "resolve"],
    })),
    stats: { activeDelays: orders.filter(o => o.status === "delayed").length, escalated: 0 },
    escalationFeatures: { autoEscalate: true, supervisorNotify: true },
  }),
  "/qc/board": (section, orders) => ({
    ...base(section),
    checks: [], complaints: [],
    orders: ordersFromKitchen(orders).map(o => ({ id: o.id, kotNumber: o.kotNumber, status: "pending", score: 95 })),
    stats: { pendingChecks: 0, failedToday: 0, randomAudits: 0 },
    qcFeatures: { randomAudit: true, complaintTracking: true },
  }),
  "/returns/board": (section) => ({
    ...base(section),
    returns: [],
    stats: { openReturns: 0, refiresToday: 0 },
    returnFeatures: { reFireWorkflow: true, guestRecovery: true },
  }),
  "/expeditor/board": (section, orders) => ({
    ...base(section),
    tickets: orders.filter(o => o.status === "ready").map(o => ({
      id: `EXP-${o.id}`, kotNumber: o.kotNumber, table: o.tableNumber ?? "—", status: "ready", section: o.section,
    })),
    stats: { readyTickets: orders.filter(o => o.status === "ready").length, coordinating: 0 },
  }),
  "/packing/board": (section, orders) => ({
    ...base(section),
    jobs: orders.filter(o => o.deliveryType === "Delivery").map(o => ({
      id: `PKG-${o.id}`, kotNumber: o.kotNumber, status: "packing", items: o.items.length,
    })),
    stats: { packing: 0, dispatched: 0 },
  }),
  "/aggregator/board": (section, orders) => ({
    ...base(section),
    orders: orders.filter(o => o.deliveryType === "Delivery").map(o => ({
      id: o.id, platform: "panel", kotNumber: o.kotNumber, status: o.status, total: 0,
    })),
    stats: { synced: 0, pending: orders.length },
    aggregatorFeatures: { swiggy: false, zomato: false, direct: true },
  }),
  "/bar/board": (section, orders) => ({
    ...base(section),
    drinks: orders.filter(o => o.section === "Beverage" || o.section === "Bar").map(o => ({
      id: `DR-${o.id}`, kotNumber: o.kotNumber, items: o.items, status: o.status, bartender: "Bar Team",
    })),
    bartenders: [{ id: "BAR-1", name: "Bar Captain", activeDrinks: 0, status: "available" }],
    stats: { queue: 0, vip: 0, avgPrepMinutes: 4 },
    barFeatures: { cocktailQueue: true, happyHour: false },
  }),
  "/bakery/board": (section) => emptyBoardSnapshot(section, { jobs: [], productionBatches: [], stats: { activeJobs: 0, batches: 0 } }),
  "/cloud-kitchen/board": (section, orders) => ({
    ...base(section),
    kitchens: [{ id: "CK-1", name: "Spice Garden", load: orders.length / 20, orders: orders.length, status: "online" }],
    stats: { activeKitchens: 1, totalOrders: orders.length },
  }),
  "/banquet/board": (section) => emptyBoardSnapshot(section, { events: [], bulkPrep: [], stats: { activeEvents: 0 } }),
  "/equipment/board": (section) => emptyBoardSnapshot(section, {
    assets: [],
    stats: { online: 0, maintenance: 0 },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/energy/board": (section) => emptyBoardSnapshot(section, {
    meters: [],
    alerts: [],
    stats: { activeAlerts: 0, shutdownEvents: 0 },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/iot/board": (section) => emptyBoardSnapshot(section, {
    devices: [],
    stats: { online: 0, offline: 0 },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/staff-performance/board": (section, orders) => emptyBoardSnapshot(section, {
    staff: [],
    stats: { avgScore: 0, topPerformer: orders.length ? "See live dashboard" : "—" },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/staff-shift/board": (section) => emptyBoardSnapshot(section, {
    shifts: [],
    swaps: [],
    handovers: [],
    stats: { onShift: 0, pendingSwaps: 0 },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/staff-wellness/board": (section) => ({
    ...base(section),
    alerts: [], recommendations: [],
    stats: { fatigueAlerts: 0, wellnessScore: 82 },
    wellnessFeatures: { fatigueAI: true, breakReminders: true },
  }),
  "/panic-emergency/board": (section) => ({
    ...base(section),
    incidents: [], evacuationAlerts: [], broadcastLog: [],
    stats: { activeIncidents: 0, panicTriggersToday: 0, resolvedToday: 0 },
    emergencyFeatures: { panicButton: true, evacuation: true, broadcast: true },
  }),
  "/offline-failover/board": (section) => emptyBoardSnapshot(section, {
    modules: [],
    queues: [],
    recoveries: [],
    stats: { offlineModules: 0, queuedEvents: 0 },
    summary: { status: "connected", source: "live-sync" },
  }),
  "/analytics-reporting/board": (section, orders) => ({
    ...base(section),
    reports: [{ id: "RPT-1", title: "Kitchen throughput", period: "today", status: "ready" }],
    insights: [{ id: "INS-1", title: "Active orders", value: String(orders.length) }],
    stats: { reportsReady: 1, insights: 1 },
  }),
  "/kitchen-heatmap/board": (section) => ({
    ...base(section),
    stations: SECTION_META.map(m => ({ id: m.id, name: m.name, heat: 0.3, orders: 0 })),
    hotspots: [], density: [],
    stats: { peakHeat: 0.3, rushZones: 0 },
  }),
  "/hardware-integration/board": (section) => ({
    ...base(section),
    displays: [{ id: "KDS-1", name: "Main KDS", status: "online" }],
    tablets: [], printers: [], smartwatches: [], nfcDevices: [], scanners: [],
    stats: { onlineDevices: 1, printersReady: 0 },
    supportedDevices: { kds: true, printers: true, nfc: true },
  }),
  "/smartwatch-support/board": (section) => ({
    ...base(section),
    orderAlerts: [], delayAlerts: [], emergencyAlerts: [], taskNotifications: [],
    stats: { pushedToday: 0, activeWatches: 0 },
  }),
  "/multi-branch/board": (section) => ({
    ...base(section),
    branches: [{ id: "BR-1", name: "Spice Garden", orders: 0, status: "online" }],
    centralKitchen: { id: "CK-1", name: "Central", load: 0 },
    stats: { branches: 1, syncedRecipes: 0 },
  }),
  "/audit-compliance/board": (section) => ({
    ...base(section),
    actionLogs: [], foodSafetyLogs: [], hygieneLogs: [], staffActivityLogs: [], incidentLogs: [],
    stats: { openIncidents: 0, complianceScore: 96 },
  }),
  "/backup-recovery/board": (section) => ({
    ...base(section),
    autoBackups: [], manualBackups: [], cloudSyncs: [], restores: [], recoveries: [],
    stats: { lastBackup: now(), recoveryPoints: 1 },
  }),
  "/sandbox-training/board": (section) => emptyBoardSnapshot(section, {
    scenarios: [],
    stats: { completed: 0, inProgress: 0 },
    summary: { status: "connected", source: "restaurant-panel" },
  }),
  "/hidden-enterprise/board": (section) => ({
    ...base(section),
    softDeletes: [], deletedOrders: [], actionReplays: [], versionLogs: [],
    deviceTracking: [], sessionLogs: [], emergencyLockdowns: [], queueRecoveries: [],
    stats: { softDeleted: 0, replayable: 0, trackedDevices: 0 },
    enterpriseFeatures: { softDelete: true, actionReplay: true, versionControl: true },
  }),
  "/future-ai-expansion/board": (section) => ({
    ...base(section),
    cookingAssistant: [], roboticKitchen: [], platingSuggestions: [], wasteReduction: [], prepAutomation: [],
    stats: { activeExperiments: 0 },
  }),
};

export async function buildModuleContext(restaurantId: number, section: string) {
  const orders = await fetchKitchenOrders(restaurantId);
  const filtered = section === "All" ? orders : orders.filter(o => o.section === section);
  return { orders, filtered, dashboard: await getDashboard(restaurantId, section) };
}

export async function resolveModuleGet(
  path: string,
  section: string,
  restaurantId: number,
  query: Record<string, string | undefined> = {},
) {
  const ctx = await buildModuleContext(restaurantId, section);
  const normalized = path.split("?")[0];

  if (normalized === "/sections/overview") {
    const overview = buildSectionOverview(section, ctx.orders);
    if (query.includeRouting === "true") {
      return { overview, routing: buildRoutingBoard() };
    }
    return overview;
  }

  if (normalized === "/dashboard/widgets") {
    return { success: true, widgets: ctx.dashboard.widgets, lastSyncedAt: ctx.dashboard.lastSyncedAt };
  }
  if (normalized === "/dashboard/metrics") {
    return { success: true, metrics: ctx.dashboard.metrics, lastSyncedAt: ctx.dashboard.lastSyncedAt };
  }
  if (normalized === "/dashboard/orders") {
    return { success: true, orders: ctx.dashboard.orders };
  }

  const dbBoard = await resolveDbModuleGet(normalized, section, restaurantId, ctx.orders);
  if (dbBoard !== undefined) {
    return dbBoard;
  }

  const builder = PATH_BUILDERS[normalized];
  if (builder) return builder(section, ctx.orders);

  if (normalized.includes("processing")) return getProcessing(restaurantId, section);
  if (normalized.includes("alert")) return getLiveAlerts(restaurantId, section);

  return emptyBoardSnapshot(section);
}

export { getDashboard, getKds, getProcessing, getLiveAlerts, buildSectionOverview, buildRoutingBoard };
