import {
  CACHE_KEYS, DEFAULT_OFFLINE_SETTINGS,
  type OfflineSettings, type QueuedOrder, type MenuCacheEntry,
} from "./offlineModeCatalog";

export function loadOfflineSettings(): OfflineSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.settings);
    if (raw) return { ...DEFAULT_OFFLINE_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_OFFLINE_SETTINGS };
}

export function saveOfflineSettings(settings: OfflineSettings) {
  localStorage.setItem(CACHE_KEYS.settings, JSON.stringify(settings));
}

export function cacheMenu(slug: string, table: string | undefined, data: unknown) {
  const items = countMenuItems(data);
  const entry: MenuCacheEntry = {
    slug,
    table,
    data,
    cachedAt: new Date().toISOString(),
    itemCount: items,
  };
  localStorage.setItem(`${CACHE_KEYS.menuPrefix}${slug}`, JSON.stringify(entry));
  return entry;
}

export function getCachedMenu(slug: string): MenuCacheEntry | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEYS.menuPrefix}${slug}`);
    if (!raw) return null;
    return JSON.parse(raw) as MenuCacheEntry;
  } catch {
    return null;
  }
}

function countMenuItems(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const d = data as { categories?: { items?: unknown[] }[] };
  if (!Array.isArray(d.categories)) return 0;
  return d.categories.reduce((sum, c) => sum + (c.items?.length ?? 0), 0);
}

export function queueOfflineOrder(order: Omit<QueuedOrder, "attempts"> & { attempts?: number }) {
  const queue = getOrderQueue();
  const entry: QueuedOrder = {
    ...order,
    attempts: order.attempts ?? 0,
  };
  queue.push(entry);
  localStorage.setItem(CACHE_KEYS.orderQueue, JSON.stringify(queue));
  return entry;
}

export function getOrderQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.orderQueue);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOrder[];
  } catch {
    return [];
  }
}

export function removeFromOrderQueue(id: string) {
  const next = getOrderQueue().filter(o => o.id !== id);
  localStorage.setItem(CACHE_KEYS.orderQueue, JSON.stringify(next));
}

export function updateOrderQueue(queue: QueuedOrder[]) {
  localStorage.setItem(CACHE_KEYS.orderQueue, JSON.stringify(queue));
}

export function setLastSyncAt(iso?: string) {
  localStorage.setItem(CACHE_KEYS.lastSync, iso ?? new Date().toISOString());
}

export function getLastSyncAt(): string | null {
  return localStorage.getItem(CACHE_KEYS.lastSync);
}

export function backupCart(cart: unknown[]) {
  localStorage.setItem(CACHE_KEYS.cartBackup, JSON.stringify({ cart, at: new Date().toISOString() }));
}

export function getCartBackup(): unknown[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.cartBackup);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cart?: unknown[] };
    return parsed.cart ?? null;
  } catch {
    return null;
  }
}

export async function probeConnection(apiBase = "/api"): Promise<"online" | "offline" | "slow"> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  try {
    const start = performance.now();
    const res = await fetch(`${apiBase}/public/offline/catalog`, { credentials: "include", cache: "no-store" });
    const ms = performance.now() - start;
    if (!res.ok) return "offline";
    return ms > 2000 ? "slow" : "online";
  } catch {
    return "offline";
  }
}
