/** Live order tracking — lifecycle stages and status mapping */
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

export interface OrderTrackingMetadata {
  tracking?: {
    chefName?: string;
    chefAssignedAt?: string;
    cookingStartedAt?: string;
    estimatedServingMinutes?: number;
    estimatedServingAt?: string;
    isDelayed?: boolean;
    delayMinutes?: number;
    delayReason?: string;
    kitchenUpdates?: KitchenUpdate[];
    waiterStatus?: WaiterStatus;
  };
}

const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  ORDER_LIFECYCLE.map((s, i) => [s.key, i]),
);

export function lifecycleIndex(stage: LifecycleStage): number {
  if (stage === "cancelled" || stage === "delayed") return -1;
  return STAGE_INDEX[stage] ?? 0;
}

export function mapDbStatusToLifecycle(dbStatus: string, meta: OrderTrackingMetadata = {}): LifecycleStage {
  const t = meta.tracking;
  if (dbStatus === "cancelled") return "cancelled";
  if (t?.isDelayed && !["delivered", "completed", "cancelled"].includes(dbStatus)) return "delayed";

  switch (dbStatus) {
    case "pending":
      return "received";
    case "confirmed":
    case "accepted":
      return "accepted";
    case "preparing":
      if (t?.cookingStartedAt) return "cooking";
      if (t?.chefAssignedAt || t?.chefName) return "chef_assigned";
      return "kitchen_preparing";
    case "ready":
      return "cooking";
    case "serving":
      return "on_the_way";
    case "delivered":
    case "completed":
      return "delivered";
    case "delayed":
      return "delayed";
    default:
      return "received";
  }
}

export function buildTrackingSnapshot(
  order: {
    status: string;
    createdAt: Date | string;
    waiterName?: string | null;
    metadata?: unknown;
  },
): OrderTrackingSnapshot {
  const meta = (order.metadata ?? {}) as OrderTrackingMetadata;
  const t = meta.tracking ?? {};
  const created = new Date(order.createdAt);
  const elapsed = Math.floor((Date.now() - created.getTime()) / 1000);
  const estMinutes = t.estimatedServingMinutes ?? 25;
  const lifecycleStage = mapDbStatusToLifecycle(order.status, meta);

  // "pending" is written explicitly when the order is created, so treating it as
  // "unset" is what makes this fallback reachable at all (see BUG.md #9).
  let waiterStatus: WaiterStatus = t.waiterStatus ?? "pending";
  if (!t.waiterStatus || t.waiterStatus === "pending") {
    if (order.status === "serving") waiterStatus = "on_the_way";
    else if (order.status === "delivered" || order.status === "completed") waiterStatus = "delivered";
    else if (order.waiterName) waiterStatus = "assigned";
  }

  const kitchenUpdates = t.kitchenUpdates?.length
    ? t.kitchenUpdates
    : defaultKitchenUpdates(order.status, t.chefName);

  const isDelayed = Boolean(t.isDelayed) || (elapsed > estMinutes * 60 && !["delivered", "completed", "cancelled"].includes(order.status));

  return {
    lifecycleStage: isDelayed && lifecycleStage !== "delivered" && lifecycleStage !== "cancelled" ? "delayed" : lifecycleStage,
    dbStatus: order.status,
    chefName: t.chefName,
    waiterName: order.waiterName ?? undefined,
    waiterStatus,
    estimatedServingMinutes: estMinutes,
    estimatedServingAt: t.estimatedServingAt,
    preparationElapsedSeconds: elapsed,
    isDelayed,
    delayMinutes: t.delayMinutes ?? (isDelayed ? Math.max(1, Math.ceil(elapsed / 60) - estMinutes) : 0),
    delayReason: t.delayReason ?? (isDelayed ? "High kitchen demand — your order is being prioritised" : undefined),
    kitchenUpdates,
  };
}

function defaultKitchenUpdates(status: string, chefName?: string): KitchenUpdate[] {
  const now = new Date().toISOString();
  const updates: KitchenUpdate[] = [{ at: now, message: "Order received by kitchen display system", type: "info" }];
  if (["confirmed", "accepted", "preparing", "ready", "serving", "delivered", "completed"].includes(status)) {
    updates.unshift({ at: now, message: "Order accepted by kitchen manager", type: "info" });
  }
  if (["preparing", "ready", "serving", "delivered", "completed"].includes(status)) {
    updates.unshift({ at: now, message: "Kitchen started preparation", type: "info" });
  }
  if (chefName && ["preparing", "ready", "serving", "delivered", "completed"].includes(status)) {
    updates.unshift({ at: now, message: `Chef ${chefName} assigned to your order`, type: "chef" });
  }
  if (["ready", "serving", "delivered", "completed"].includes(status)) {
    updates.unshift({ at: now, message: "Cooking complete — plating in progress", type: "ready" });
  }
  if (["serving", "delivered", "completed"].includes(status)) {
    updates.unshift({ at: now, message: "Waiter picked up order — on the way to your table", type: "info" });
  }
  return updates;
}

export function initialTrackingMetadata(prepMinutes = 25): OrderTrackingMetadata {
  const at = new Date(Date.now() + prepMinutes * 60000).toISOString();
  return {
    tracking: {
      estimatedServingMinutes: prepMinutes,
      estimatedServingAt: at,
      waiterStatus: "pending",
      kitchenUpdates: [
        { at: new Date().toISOString(), message: "Order received — sent to kitchen", type: "info" },
      ],
    },
  };
}

export const WAITER_STATUS_LABELS: Record<WaiterStatus, string> = {
  pending: "Awaiting assignment",
  assigned: "Waiter assigned",
  picking_up: "Picking up from kitchen",
  on_the_way: "On the way to your table",
  at_table: "At your table",
  delivered: "Order served",
};
