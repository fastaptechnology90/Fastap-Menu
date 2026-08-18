/** Advanced Ordering System — shared catalog */
export const ORDER_TYPES = [
  { id: "dine-in", label: "Dine-in", icon: "🍽️", apiType: "dine_in" },
  { id: "takeaway", label: "Takeaway", icon: "🛍️", apiType: "takeaway" },
  { id: "drive-in", label: "Drive-in", icon: "🚗", apiType: "drive_in" },
  { id: "drive-through", label: "Drive-through", icon: "🛣️", apiType: "drive_through" },
  { id: "room-service", label: "Room Service", icon: "🏨", apiType: "room_service" },
  { id: "poolside", label: "Poolside", icon: "🏊", apiType: "poolside" },
  { id: "spa", label: "Spa Ordering", icon: "💆", apiType: "spa" },
  { id: "bar", label: "Bar Ordering", icon: "🍸", apiType: "bar" },
  { id: "lounge", label: "Lounge", icon: "🛋️", apiType: "lounge" },
  { id: "event", label: "Event", icon: "🎊", apiType: "event" },
  { id: "cabana", label: "Cabana", icon: "🏖️", apiType: "cabana" },
] as const;

/** Shown on table-QR cart — pickup alternatives only (dine-in is implicit at the scanned table). */
export const CART_PICKUP_ORDER_TYPES = ORDER_TYPES.filter(
  t => t.id === "takeaway" || t.id === "drive-in",
);

export type OrderTypeId = (typeof ORDER_TYPES)[number]["id"];

export const ORDER_TYPE_MAP = Object.fromEntries(ORDER_TYPES.map(t => [t.id, t.apiType])) as Record<OrderTypeId, string>;

export const COURSE_TIMING_OPTIONS = [
  { id: "starters_first", label: "Serve starters first", desc: "Starters → then mains & desserts" },
  { id: "all_together", label: "All together", desc: "Simultaneous serving — everything at once" },
  { id: "sequential", label: "Sequential serving", desc: "Starter → Main → Dessert in order" },
  { id: "delayed_mains", label: "Starters → 15min → Mains", desc: "Delay main course by 15 minutes" },
] as const;

export type CourseTimingId = (typeof COURSE_TIMING_OPTIONS)[number]["id"];

export const SPECIAL_REQUEST_TAGS = [
  { id: "birthday", label: "🎂 Birthday Surprise", flag: "birthday_surprise" },
  { id: "anniversary", label: "💑 Anniversary Setup", flag: "anniversary_setup" },
  { id: "candlelight", label: "🕯️ Candlelight Dining", flag: "candlelight_dining" },
  { id: "kids", label: "🧒 Kids Serving", flag: "kids_serving" },
  { id: "allergy", label: "⚠️ Allergy Alert", flag: "allergy_alert" },
] as const;

export function serviceModeToOrderType(serviceMode: string, zone?: string): OrderTypeId {
  const map: Record<string, OrderTypeId> = {
    dine_in: "dine-in",
    takeaway: "takeaway",
    drive_in: "drive-in",
    drive_through: "drive-through",
    room_service: "room-service",
    poolside: "poolside",
    spa: "spa",
    bar: "bar",
    lounge: "lounge",
    event: "event",
    cabana: "cabana",
    parking_valet: "drive-in",
    browse: "dine-in",
  };
  if (zone?.includes("bar")) return "bar";
  if (zone?.includes("lounge") || zone?.includes("vip")) return "lounge";
  if (zone?.includes("cabana")) return "cabana";
  return map[serviceMode] ?? "dine-in";
}

export interface OrderMetadata {
  courseTiming?: CourseTimingId;
  servingMode?: "sequential" | "simultaneous";
  splitBilling?: { enabled: boolean; count: number; perPerson: number };
  specialFlags?: string[];
  allergyInstructions?: string;
  scheduledOrdering?: boolean;
  groupOrdering?: boolean;
  shareCode?: string;
}

export const DEMO_UPSELL_RULES = [
  { ifMissingCourse: "dessert", suggest: "Gulab Jamun", category: "desserts", reason: "Complete your meal with dessert" },
  { ifMissingCourse: "beverage", suggest: "Mango Lassi", category: "soft-drinks", reason: "Pair with a refreshing drink" },
  { ifMissingCourse: "starter", suggest: "Chicken Tikka", category: "starters", reason: "Start with a popular starter" },
];
