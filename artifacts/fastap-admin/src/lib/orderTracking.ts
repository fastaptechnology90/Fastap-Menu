/** Live order tracking — frontend catalog */
export const ORDER_LIFECYCLE = [
  { key: "received", label: "Order Received", icon: "📥", desc: "Your order has been sent to the kitchen" },
  { key: "accepted", label: "Accepted", icon: "✅", desc: "Restaurant has accepted your order" },
  { key: "kitchen_preparing", label: "Kitchen Preparing", icon: "👨‍🍳", desc: "Kitchen team is getting ingredients ready" },
  { key: "chef_assigned", label: "Chef Assigned", icon: "🎖️", desc: "A chef has been assigned to your order" },
  { key: "cooking", label: "Cooking in Progress", icon: "🔥", desc: "Your food is being cooked fresh" },
  { key: "on_the_way", label: "On the Way", icon: "🛎️", desc: "Waiter is bringing your order to the table" },
  { key: "delivered", label: "Delivered", icon: "🎉", desc: "Enjoy your meal!" },
] as const;

export type LifecycleStage = (typeof ORDER_LIFECYCLE)[number]["key"] | "delayed" | "cancelled";

export type KitchenUpdate = { at: string; message: string; type?: "info" | "chef" | "delay" | "ready" };
export type WaiterStatus = "pending" | "assigned" | "picking_up" | "on_the_way" | "at_table" | "delivered";

export interface OrderTrackingSnapshot {
  lifecycleStage: LifecycleStage;
  dbStatus: string;
  chefName?: string;
  waiterName?: string;
  waiterStatus: WaiterStatus;
  estimatedServingMinutes: number;
  estimatedServingAt?: string;
  preparationElapsedSeconds: number;
  isDelayed: boolean;
  delayMinutes: number;
  delayReason?: string;
  kitchenUpdates: KitchenUpdate[];
}

export const WAITER_STATUS_LABELS: Record<WaiterStatus, string> = {
  pending: "Awaiting assignment",
  assigned: "Waiter assigned",
  picking_up: "Picking up from kitchen",
  on_the_way: "On the way to your table",
  at_table: "At your table",
  delivered: "Order served",
};

export function lifecycleIndex(stage: LifecycleStage): number {
  if (stage === "cancelled" || stage === "delayed") return -1;
  return ORDER_LIFECYCLE.findIndex(s => s.key === stage);
}

export function buildDemoTracking(stage: LifecycleStage, elapsedMin: number): OrderTrackingSnapshot {
  const isDelayed = stage === "delayed";
  const effective = isDelayed ? "cooking" as LifecycleStage : stage;
  const idx = lifecycleIndex(effective);
  return {
    lifecycleStage: stage,
    dbStatus: stage === "cancelled" ? "cancelled" : "preparing",
    chefName: idx >= 3 ? "Chef Priya Sharma" : undefined,
    waiterName: idx >= 4 ? "Assigned waiter" : undefined,
    waiterStatus: idx >= 6 ? "delivered" : idx >= 5 ? "on_the_way" : idx >= 4 ? "assigned" : "pending",
    estimatedServingMinutes: 25,
    estimatedServingAt: new Date(Date.now() + Math.max(5, 25 - elapsedMin) * 60000).toISOString(),
    preparationElapsedSeconds: elapsedMin * 60,
    isDelayed,
    delayMinutes: isDelayed ? 8 : 0,
    delayReason: isDelayed ? "High demand — kitchen added extra care to your order" : undefined,
    kitchenUpdates: demoKitchenFeed(idx, elapsedMin),
  };
}

function demoKitchenFeed(stageIdx: number, elapsedMin: number): KitchenUpdate[] {
  const base = Date.now() - elapsedMin * 60000;
  const t = (m: number) => new Date(base + m * 60000).toISOString();
  const feed: KitchenUpdate[] = [{ at: t(0), message: "Order received by kitchen display", type: "info" }];
  if (stageIdx >= 1) feed.unshift({ at: t(1), message: "Order accepted by floor manager", type: "info" });
  if (stageIdx >= 2) feed.unshift({ at: t(3), message: "Kitchen started prep — gathering ingredients", type: "info" });
  if (stageIdx >= 3) feed.unshift({ at: t(5), message: "Chef Priya Sharma assigned to your order", type: "chef" });
  if (stageIdx >= 4) feed.unshift({ at: t(8), message: "Cooking in progress on tandoor station", type: "info" });
  if (stageIdx >= 5) feed.unshift({ at: t(18), message: "Plating complete — waiter notified", type: "ready" });
  if (stageIdx >= 6) feed.unshift({ at: t(22), message: "Your waiter is on the way with your order", type: "info" });
  return feed;
}

export const DEMO_LIFECYCLE_SEQUENCE: LifecycleStage[] = [
  "received", "accepted", "kitchen_preparing", "chef_assigned", "cooking", "on_the_way", "delivered",
];
