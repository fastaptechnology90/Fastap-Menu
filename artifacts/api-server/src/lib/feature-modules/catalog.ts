/**
 * Canonical catalog for all 49 kitchen enterprise systems.
 * Single source of truth linking mobile app, restaurant panel, and super admin.
 */

export type FeatureSurface = "mobile" | "restaurant" | "guest";

export interface FeatureModule {
  number: number;
  key: string;
  title: string;
  category: string;
  surfaces: FeatureSurface[];
  /** Primary mobile GET path (systems 2–49). */
  apiPath?: string;
  /** Restaurant panel paths this module unlocks. */
  restaurantPaths?: string[];
  /** Related system numbers (workflow links for UI). */
  linkedSystems: number[];
  /** Hard prerequisites — module stays off if any required system is off. */
  requiresSystems?: number[];
  /** Minimum plan tier that includes this module by default. */
  minPlan: "free" | "starter" | "pro" | "enterprise";
}

export const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function planIncludesModule(plan: string, minPlan: FeatureModule["minPlan"]): boolean {
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[minPlan] ?? 0);
}

function mod(
  number: number,
  title: string,
  category: string,
  opts: Partial<Omit<FeatureModule, "number" | "title" | "category" | "key">> & {
    linkedSystems?: number[];
    minPlan?: FeatureModule["minPlan"];
  } = {},
): FeatureModule {
  return {
    number,
    key: `system_${number}`,
    title,
    category,
    surfaces: opts.surfaces ?? ["mobile"],
    apiPath: opts.apiPath,
    restaurantPaths: opts.restaurantPaths,
    linkedSystems: opts.linkedSystems ?? [],
    requiresSystems: opts.requiresSystems,
    minPlan: opts.minPlan ?? "starter",
  };
}

/** All enterprise kitchen systems (1–49). */
export const FEATURE_MODULES: FeatureModule[] = [
  mod(1, "Authentication & Security System", "Core", {
    surfaces: ["mobile", "restaurant"],
    restaurantPaths: ["/restaurant/rbac", "/restaurant/settings"],
    linkedSystems: [2],
    minPlan: "free",
  }),
  mod(2, "Kitchen Dashboard System", "Operations", {
    apiPath: "/dashboard",
    restaurantPaths: ["/restaurant/dashboard"],
    linkedSystems: [3, 5, 36],
    minPlan: "free",
  }),
  mod(3, "Live KDS (Kitchen Display System)", "Operations", {
    apiPath: "/kds",
    restaurantPaths: ["/restaurant/kitchen"],
    linkedSystems: [2, 5, 12, 18, 21],
    requiresSystems: [5],
    minPlan: "free",
  }),
  mod(4, "Multi Kitchen Section Management", "Operations", {
    apiPath: "/sections/overview",
    linkedSystems: [2, 3, 5],
    minPlan: "starter",
  }),
  mod(5, "Advanced Order Processing System", "Operations", {
    apiPath: "/orders/processing",
    restaurantPaths: ["/restaurant/orders"],
    linkedSystems: [3, 12, 21, 22, 49],
    minPlan: "free",
  }),
  mod(6, "Food Firing & Course Management", "Kitchen", {
    apiPath: "/course-firing/sessions",
    linkedSystems: [5, 7],
    minPlan: "starter",
  }),
  mod(7, "Food Preparation Management", "Kitchen", {
    apiPath: "/prep/board",
    linkedSystems: [5, 6, 16],
    minPlan: "starter",
  }),
  mod(8, "Modifier & Customization Management", "Kitchen", {
    apiPath: "/modifiers/board",
    linkedSystems: [5, 9],
    minPlan: "starter",
  }),
  mod(9, "Food Allergy & Safety Engine", "Safety", {
    apiPath: "/allergy-safety/board",
    linkedSystems: [5, 8],
    minPlan: "starter",
  }),
  mod(10, "Chef Task Management System", "Staff", {
    apiPath: "/chef-tasks/board",
    restaurantPaths: ["/restaurant/tasks-sop"],
    linkedSystems: [7, 33],
    minPlan: "starter",
  }),
  mod(11, "AI Kitchen Assistant", "AI", {
    apiPath: "/ai/assistant",
    restaurantPaths: ["/restaurant/ai-features"],
    linkedSystems: [2, 5, 48],
    minPlan: "pro",
  }),
  mod(12, "Order Priority Engine", "Operations", {
    apiPath: "/order-priority/board",
    linkedSystems: [3, 5, 18],
    minPlan: "starter",
  }),
  mod(13, "Kitchen Communication System", "Communication", {
    apiPath: "/kitchen-communication/board",
    restaurantPaths: ["/restaurant/communications"],
    linkedSystems: [3, 36],
    minPlan: "starter",
  }),
  mod(14, "Inventory & Stock Integration", "Inventory", {
    apiPath: "/inventory/board",
    restaurantPaths: ["/restaurant/inventory"],
    linkedSystems: [15, 16, 30],
    minPlan: "starter",
  }),
  mod(15, "Recipe & Food Costing System", "Inventory", {
    apiPath: "/recipe-costing/board",
    restaurantPaths: ["/restaurant/food-costing"],
    linkedSystems: [14, 16],
    minPlan: "starter",
  }),
  mod(16, "Prep Station Management System", "Kitchen", {
    apiPath: "/prep-stations/board",
    linkedSystems: [7, 14, 15],
    minPlan: "starter",
  }),
  mod(17, "Advanced Batch Cooking System", "Kitchen", {
    apiPath: "/batch-cooking/board",
    linkedSystems: [7, 16],
    minPlan: "pro",
  }),
  mod(18, "Delay & Escalation System", "Alerts", {
    apiPath: "/delay-escalation/board",
    linkedSystems: [3, 12, 36],
    minPlan: "starter",
  }),
  mod(19, "Quality Control System", "Quality", {
    apiPath: "/quality-control/board",
    linkedSystems: [5, 20],
    minPlan: "pro",
  }),
  mod(20, "Customer Return & Re-fire System", "Operations", {
    apiPath: "/customer-return/board",
    linkedSystems: [3, 19],
    minPlan: "pro",
  }),
  mod(21, "Expeditor Management System", "Operations", {
    apiPath: "/expeditor/board",
    linkedSystems: [3, 5, 22],
    requiresSystems: [3, 5],
    minPlan: "pro",
  }),
  mod(22, "Packing & Delivery Preparation System", "Operations", {
    apiPath: "/packing/board",
    linkedSystems: [21, 23, 49],
    requiresSystems: [21],
    minPlan: "pro",
  }),
  mod(23, "Delivery Aggregator System", "Delivery", {
    apiPath: "/delivery-aggregator/board",
    restaurantPaths: ["/restaurant/aggregators"],
    linkedSystems: [22],
    requiresSystems: [22],
    minPlan: "pro",
  }),
  mod(24, "Bar & Beverage Kitchen System", "Specialty", {
    apiPath: "/bar-beverage/board",
    restaurantPaths: ["/restaurant/spa-bar"],
    linkedSystems: [5],
    minPlan: "pro",
  }),
  mod(25, "Bakery & Dessert Management", "Specialty", {
    apiPath: "/bakery-dessert/board",
    linkedSystems: [5, 7],
    minPlan: "pro",
  }),
  mod(26, "Cloud Kitchen Management", "Enterprise", {
    apiPath: "/cloud-kitchen/board",
    linkedSystems: [43],
    minPlan: "enterprise",
  }),
  mod(27, "Event & Banquet Kitchen System", "Events", {
    apiPath: "/banquet/board",
    restaurantPaths: ["/restaurant/events"],
    linkedSystems: [5, 28],
    minPlan: "pro",
  }),
  mod(28, "Room Service Kitchen System", "Hotel", {
    apiPath: "/room-service/board",
    restaurantPaths: ["/restaurant/room-service"],
    linkedSystems: [5, 27],
    minPlan: "pro",
  }),
  mod(29, "Cleaning & Hygiene Management", "Compliance", {
    apiPath: "/cleaning-hygiene/board",
    restaurantPaths: ["/restaurant/housekeeping"],
    linkedSystems: [44],
    minPlan: "pro",
  }),
  mod(30, "Equipment Management System", "IoT", {
    apiPath: "/equipment/board",
    restaurantPaths: ["/restaurant/documents"],
    linkedSystems: [14, 31, 32],
    minPlan: "pro",
  }),
  mod(31, "Smart Energy & Gas Monitoring", "IoT", {
    apiPath: "/smart-energy/board",
    linkedSystems: [30, 32],
    minPlan: "enterprise",
  }),
  mod(32, "IoT Device Integration System", "IoT", {
    apiPath: "/iot-devices/board",
    linkedSystems: [30, 31, 41],
    minPlan: "enterprise",
  }),
  mod(33, "Staff Performance System", "Staff", {
    apiPath: "/staff-performance/board",
    restaurantPaths: ["/restaurant/staff"],
    linkedSystems: [10, 34, 35],
    minPlan: "pro",
  }),
  mod(34, "Staff Shift Management", "Staff", {
    apiPath: "/staff-shift/board",
    restaurantPaths: ["/restaurant/staff"],
    linkedSystems: [33, 35],
    minPlan: "pro",
  }),
  mod(35, "Staff Fatigue & Wellness AI", "Staff", {
    apiPath: "/staff-wellness/board",
    linkedSystems: [33, 34],
    minPlan: "enterprise",
  }),
  mod(36, "Live Alert Engine", "Alerts", {
    apiPath: "/live-alerts/board",
    restaurantPaths: ["/restaurant/notifications"],
    linkedSystems: [2, 3, 18, 37],
    minPlan: "free",
  }),
  mod(37, "Panic & Emergency System", "Safety", {
    apiPath: "/panic-emergency/board",
    linkedSystems: [36],
    minPlan: "pro",
  }),
  mod(38, "Offline Mode & Failover System", "Technology", {
    apiPath: "/offline-failover/board",
    restaurantPaths: ["/restaurant/offline"],
    linkedSystems: [45],
    minPlan: "enterprise",
  }),
  mod(39, "Analytics & Reporting System", "Reports", {
    apiPath: "/analytics-reporting/board",
    restaurantPaths: ["/restaurant/analytics"],
    linkedSystems: [2, 40],
    minPlan: "pro",
  }),
  mod(40, "Live Kitchen Heatmap System", "Reports", {
    apiPath: "/kitchen-heatmap/board",
    linkedSystems: [2, 39],
    minPlan: "enterprise",
  }),
  mod(41, "Hardware Integration System", "Technology", {
    apiPath: "/hardware-integration/board",
    restaurantPaths: ["/restaurant/documents", "/restaurant/digital-signage"],
    linkedSystems: [32],
    minPlan: "pro",
  }),
  mod(42, "Smartwatch Support", "Technology", {
    apiPath: "/smartwatch-support/board",
    linkedSystems: [3, 36],
    minPlan: "enterprise",
  }),
  mod(43, "Multi Branch & Central Kitchen System", "Enterprise", {
    apiPath: "/multi-branch/board",
    restaurantPaths: ["/restaurant/branches"],
    linkedSystems: [26],
    minPlan: "enterprise",
  }),
  mod(44, "Audit & Compliance System", "Compliance", {
    apiPath: "/audit-compliance/board",
    restaurantPaths: ["/restaurant/audit"],
    linkedSystems: [29],
    minPlan: "enterprise",
  }),
  mod(45, "Backup & Recovery System", "Technology", {
    apiPath: "/backup-recovery/board",
    restaurantPaths: ["/restaurant/backup"],
    linkedSystems: [38],
    minPlan: "enterprise",
  }),
  mod(46, "Sandbox & Training Mode", "Training", {
    apiPath: "/sandbox-training/board",
    restaurantPaths: ["/restaurant/sandbox"],
    linkedSystems: [1],
    minPlan: "enterprise",
  }),
  mod(47, "Hidden Enterprise Features", "Enterprise", {
    apiPath: "/hidden-enterprise/board",
    minPlan: "enterprise",
  }),
  mod(48, "Future AI Expansion Features", "AI", {
    apiPath: "/future-ai-expansion/board",
    restaurantPaths: ["/restaurant/ai-features"],
    linkedSystems: [11],
    minPlan: "enterprise",
  }),
  mod(49, "Waiter Auto Assignment System", "Operations", {
    apiPath: "/waiter-auto-assignment/board",
    restaurantPaths: ["/restaurant/waiter", "/restaurant/queue"],
    linkedSystems: [5, 22],
    requiresSystems: [5],
    minPlan: "starter",
  }),
];

/** All restaurant manager panel routes — used to unlock full sidebar for paid plans. */
export const RESTAURANT_PANEL_PATHS = [
  "/restaurant/dashboard",
  "/restaurant/orders",
  "/restaurant/tables",
  "/restaurant/queue",
  "/restaurant/waiter",
  "/restaurant/kitchen",
  "/restaurant/billing",
  "/restaurant/cash-counter",
  "/restaurant/menu",
  "/restaurant/inventory",
  "/restaurant/food-costing",
  "/restaurant/procurement",
  "/restaurant/customers",
  "/restaurant/reservations",
  "/restaurant/loyalty",
  "/restaurant/marketing",
  "/restaurant/reviews",
  "/restaurant/room-service",
  "/restaurant/housekeeping",
  "/restaurant/spa-bar",
  "/restaurant/events",
  "/restaurant/staff",
  "/restaurant/staff-apps",
  "/restaurant/commissions",
  "/restaurant/tasks-sop",
  "/restaurant/analytics",
  "/restaurant/finance",
  "/restaurant/corporate-billing",
  "/restaurant/qr-management",
  "/restaurant/digital-signage",
  "/restaurant/kiosk",
  "/restaurant/offline",
  "/restaurant/aggregators",
  "/restaurant/api-platform",
  "/restaurant/documents",
  "/restaurant/branches",
  "/restaurant/ai-features",
  "/restaurant/white-label",
  "/restaurant/feature-control",
  "/restaurant/rbac",
  "/restaurant/audit",
  "/restaurant/monitoring",
  "/restaurant/backup",
  "/restaurant/notifications",
  "/restaurant/communications",
  "/restaurant/sandbox",
  "/restaurant/accessibility",
  "/restaurant/settings",
] as const;

export const FEATURE_MODULE_BY_NUMBER = new Map(
  FEATURE_MODULES.map((m) => [m.number, m]),
);

export const FEATURE_MODULE_BY_KEY = new Map(
  FEATURE_MODULES.map((m) => [m.key, m]),
);

export const FEATURE_MODULE_BY_API_PATH = new Map(
  FEATURE_MODULES.filter((m) => m.apiPath).map((m) => [m.apiPath!, m]),
);

export function systemNumberForApiPath(path: string): number | null {
  const normalized = path.split("?")[0];

  const ALIASES: Record<string, number> = {
    "/dashboard": 2,
    "/kds": 3,
    "/sections/overview": 4,
    "/orders/processing": 5,
    "/firing/sessions": 6,
    "/course-firing/sessions": 6,
    "/prep/board": 7,
    "/modifiers/board": 8,
    "/safety/board": 9,
    "/chef-tasks/board": 10,
    "/ai/assistant": 11,
    "/orders/priority": 12,
    "/order-priority/board": 12,
    "/kitchen/communication": 13,
    "/kitchen-communication/board": 13,
    "/inventory/board": 14,
    "/recipes/costing": 15,
    "/prep/stations": 16,
    "/batch/cooking": 17,
    "/delays/board": 18,
    "/qc/board": 19,
    "/returns/board": 20,
    "/expeditor/board": 21,
    "/packing/board": 22,
    "/aggregator/board": 23,
    "/bar/board": 24,
    "/bakery/board": 25,
    "/cloud-kitchen/board": 26,
    "/banquet/board": 27,
    "/room-service/board": 28,
    "/hygiene/board": 29,
    "/cleaning-hygiene/board": 29,
    "/equipment/board": 30,
    "/energy/board": 31,
    "/iot/board": 32,
    "/staff-performance/board": 33,
    "/staff-shift/board": 34,
    "/staff-wellness/board": 35,
    "/live-alerts/board": 36,
    "/panic-emergency/board": 37,
    "/offline-failover/board": 38,
    "/analytics-reporting/board": 39,
    "/kitchen-heatmap/board": 40,
    "/hardware-integration/board": 41,
    "/smartwatch-support/board": 42,
    "/multi-branch/board": 43,
    "/audit-compliance/board": 44,
    "/backup-recovery/board": 45,
    "/sandbox-training/board": 46,
    "/hidden-enterprise/board": 47,
    "/future-ai-expansion/board": 48,
    "/waiter-auto-assignment/board": 49,
  };
  if (ALIASES[normalized] != null) return ALIASES[normalized];

  const prefixRules: Array<[string, number]> = [
    ["/dashboard", 2],
    ["/kds", 3],
    ["/sections", 4],
    ["/orders/processing", 5],
    ["/firing", 6],
    ["/prep", 7],
    ["/modifiers", 8],
    ["/safety", 9],
    ["/chef-tasks", 10],
    ["/ai/assistant", 11],
    ["/orders/priority", 12],
    ["/kitchen/communication", 13],
    ["/inventory", 14],
    ["/recipes", 15],
    ["/batch", 17],
    ["/delays", 18],
    ["/qc", 19],
    ["/returns", 20],
    ["/expeditor", 21],
    ["/packing", 22],
    ["/aggregator", 23],
    ["/bar", 24],
    ["/bakery", 25],
    ["/cloud-kitchen", 26],
    ["/banquet", 27],
    ["/room-service", 28],
    ["/hygiene", 29],
    ["/equipment", 30],
    ["/energy", 31],
    ["/iot", 32],
    ["/staff-performance", 33],
    ["/staff-shift", 34],
    ["/staff-wellness", 35],
    ["/live-alerts", 36],
    ["/panic-emergency", 37],
    ["/offline-failover", 38],
    ["/analytics-reporting", 39],
    ["/kitchen-heatmap", 40],
    ["/hardware-integration", 41],
    ["/smartwatch-support", 42],
    ["/multi-branch", 43],
    ["/audit-compliance", 44],
    ["/backup-recovery", 45],
    ["/sandbox-training", 46],
    ["/hidden-enterprise", 47],
    ["/future-ai-expansion", 48],
    ["/waiter-auto-assignment", 49],
  ];
  for (const [prefix, num] of prefixRules) {
    if (normalized.startsWith(prefix)) return num;
  }

  const exact = FEATURE_MODULE_BY_API_PATH.get(normalized);
  if (exact) return exact.number;
  for (const mod of FEATURE_MODULES) {
    if (mod.apiPath && normalized.startsWith(mod.apiPath)) {
      return mod.number;
    }
  }
  if (normalized.startsWith("/dashboard")) return 2;
  if (normalized.startsWith("/kds")) return 3;
  if (normalized.startsWith("/orders/processing")) return 5;
  return null;
}

export function catalogPayload() {
  return {
    version: 1,
    systemCount: FEATURE_MODULES.length,
    modules: FEATURE_MODULES.map((m) => ({
      number: m.number,
      key: m.key,
      title: m.title,
      category: m.category,
      surfaces: m.surfaces,
      apiPath: m.apiPath ?? null,
      restaurantPaths: m.restaurantPaths ?? [],
      linkedSystems: m.linkedSystems,
      requiresSystems: m.requiresSystems ?? [],
      minPlan: m.minPlan,
    })),
  };
}
