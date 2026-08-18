export function getOfflineCatalog() {
  return {
    features: ["offline_menu", "offline_order_cache", "auto_sync_recovery", "low_bandwidth"],
    maxQueueSize: 20,
    menuCacheTtlHours: 72,
    autoSyncIntervalSeconds: 30,
    lowBandwidthSavings: "80%",
  };
}

export type SyncOrderPayload = {
  clientId: string;
  body: Record<string, unknown>;
  createdAt?: string;
};

export type SyncOrderResult = {
  clientId: string;
  success: boolean;
  orderId?: number;
  error?: string;
};

export function buildSyncSummary(results: SyncOrderResult[]) {
  const synced = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return {
    synced,
    failed,
    total: results.length,
    message: failed === 0
      ? `${synced} order(s) synced successfully`
      : `${synced} synced, ${failed} failed — will retry`,
  };
}

export function validateOrderPayload(body: Record<string, unknown>): string | null {
  if (!body.restaurantId) return "restaurantId required";
  if (!Array.isArray(body.items) || body.items.length === 0) return "items required";
  return null;
}
