/** Offline Mode & Low Internet Optimization — catalog & demo data */

export type OfflineFeatureId =
  | "offline_menu"
  | "offline_order_cache"
  | "auto_sync_recovery"
  | "low_bandwidth";

export const OFFLINE_FEATURES = [
  { id: "offline_menu" as const, label: "Offline Menu Loading", icon: "📋", desc: "Menu cached locally — browse without internet" },
  { id: "offline_order_cache" as const, label: "Offline Order Cache", icon: "📦", desc: "Orders saved locally when offline, sent when back online" },
  { id: "auto_sync_recovery" as const, label: "Auto Sync Recovery", icon: "🔄", desc: "Automatically syncs cart & pending orders when connection returns" },
  { id: "low_bandwidth" as const, label: "Low Bandwidth Mode", icon: "📶", desc: "Text-only menu, no images — saves up to 80% data" },
];

export const LOW_BANDWIDTH_SAVINGS = {
  imagesDisabled: true,
  estimatedDataSaving: "80%",
  videoDisabled: true,
  reducedAnimations: true,
};

export const DEMO_OFFLINE_STATUS = {
  menuCached: true,
  menuCachedAt: new Date(Date.now() - 3600000).toISOString(),
  menuItemCount: 48,
  pendingOrders: 1,
  lastSyncAt: new Date(Date.now() - 7200000).toISOString(),
  connectionQuality: "poor" as const,
  lowBandwidthEnabled: false,
};

export const CACHE_KEYS = {
  menuPrefix: "fastap_menu_cache_",
  orderQueue: "fastap_offline_order_queue",
  settings: "fastap_offline_settings",
  lastSync: "fastap_offline_last_sync",
  cartBackup: "fastap_offline_cart_backup",
};

export type OfflineSettings = {
  lowBandwidthMode: boolean;
  autoSyncEnabled: boolean;
};

export const DEFAULT_OFFLINE_SETTINGS: OfflineSettings = {
  lowBandwidthMode: false,
  autoSyncEnabled: true,
};

export type QueuedOrder = {
  id: string;
  body: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  restaurantName?: string;
  total?: number;
  itemCount?: number;
};

export type MenuCacheEntry = {
  slug: string;
  table?: string;
  data: unknown;
  cachedAt: string;
  itemCount: number;
};
