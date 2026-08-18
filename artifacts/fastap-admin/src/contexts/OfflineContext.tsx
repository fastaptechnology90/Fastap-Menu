import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from "react";
import { publicApi } from "@/lib/api";
import {
  OFFLINE_FEATURES,
  type OfflineSettings,
} from "@/lib/offlineModeCatalog";
import {
  loadOfflineSettings, saveOfflineSettings, cacheMenu, getCachedMenu,
  getOrderQueue, queueOfflineOrder, removeFromOrderQueue, updateOrderQueue,
  setLastSyncAt, getLastSyncAt, probeConnection, backupCart,
} from "@/lib/offlineStorage";

type ConnectionStatus = "online" | "offline" | "slow";

interface OfflineContextValue {
  isOnline: boolean;
  connectionStatus: ConnectionStatus;
  settings: OfflineSettings;
  pendingOrders: ReturnType<typeof getOrderQueue>;
  menuCache: ReturnType<typeof getCachedMenu>;
  lastSyncAt: string | null;
  syncing: boolean;
  setLowBandwidthMode: (enabled: boolean) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  loadMenuWithCache: <T>(slug: string, table: string | undefined, fetcher: () => Promise<T>) => Promise<{ data: T; fromCache: boolean }>;
  enqueueOrder: (payload: { id: string; body: Record<string, unknown>; restaurantName?: string; total?: number; itemCount?: number }) => void;
  syncPendingOrders: () => Promise<{ synced: number; failed: number }>;
  refreshStatus: () => Promise<void>;
  cacheCart: (cart: unknown[]) => void;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

function applyLowBandwidth(enabled: boolean) {
  document.documentElement.setAttribute("data-low-bandwidth", enabled ? "on" : "off");
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("online");
  const [settings, setSettings] = useState<OfflineSettings>(loadOfflineSettings);
  const [pendingOrders, setPendingOrders] = useState(getOrderQueue);
  const [menuCache, setMenuCache] = useState<ReturnType<typeof getCachedMenu>>(null);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(getLastSyncAt);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    const status = await probeConnection();
    setConnectionStatus(status);
    setPendingOrders(getOrderQueue());
    setLastSyncAtState(getLastSyncAt());
  }, []);

  const syncPendingOrders = useCallback(async () => {
    const queue = getOrderQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    setSyncing(true);
    let synced = 0;
    let failed = 0;
    const successIds = new Set<string>();

    try {
      for (const entry of queue) {
        try {
          await publicApi.createOrder(entry.body);
          successIds.add(entry.id);
          synced++;
        } catch {
          try {
            const res = await publicApi.offline.syncOrders([
              { clientId: entry.id, body: entry.body, createdAt: entry.createdAt },
            ]);
            const ok = (res.results ?? []).some((r: { success: boolean; clientId: string }) => r.success && r.clientId === entry.id);
            if (ok) {
              successIds.add(entry.id);
              synced++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }
      }

      const remaining = queue.filter(o => !successIds.has(o.id));
      updateOrderQueue(remaining);
      setPendingOrders(remaining);
      if (synced > 0) {
        setLastSyncAt(new Date().toISOString());
        setLastSyncAtState(getLastSyncAt());
      }
      return { synced, failed };
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    applyLowBandwidth(settings.lowBandwidthMode);
    saveOfflineSettings(settings);
  }, [settings]);

  useEffect(() => {
    refreshStatus();
    const onOnline = () => {
      refreshStatus();
      if (settings.autoSyncEnabled) syncPendingOrders();
    };
    const onOffline = () => setConnectionStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => {
      refreshStatus();
      if (settings.autoSyncEnabled && navigator.onLine) syncPendingOrders();
    }, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [refreshStatus, syncPendingOrders, settings.autoSyncEnabled]);

  const setLowBandwidthMode = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, lowBandwidthMode: enabled }));
  }, []);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, autoSyncEnabled: enabled }));
  }, []);

  const loadMenuWithCache = useCallback(async <T,>(
    slug: string,
    table: string | undefined,
    fetcher: () => Promise<T>,
  ): Promise<{ data: T; fromCache: boolean }> => {
    try {
      const data = await fetcher();
      cacheMenu(slug, table, data);
      setMenuCache(getCachedMenu(slug));
      return { data, fromCache: false };
    } catch {
      const cached = getCachedMenu(slug);
      if (cached?.data) {
        setMenuCache(cached);
        return { data: cached.data as T, fromCache: true };
      }
      throw new Error("No menu available offline");
    }
  }, []);

  const enqueueOrder = useCallback((payload: {
    id: string; body: Record<string, unknown>; restaurantName?: string; total?: number; itemCount?: number;
  }) => {
    queueOfflineOrder({ ...payload, createdAt: new Date().toISOString() });
    setPendingOrders(getOrderQueue());
  }, []);

  const cacheCart = useCallback((cart: unknown[]) => {
    backupCart(cart);
  }, []);

  return (
    <OfflineContext.Provider value={{
      isOnline: connectionStatus !== "offline",
      connectionStatus,
      settings,
      pendingOrders,
      menuCache,
      lastSyncAt,
      syncing,
      setLowBandwidthMode,
      setAutoSyncEnabled,
      loadMenuWithCache,
      enqueueOrder,
      syncPendingOrders,
      refreshStatus,
      cacheCart,
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}

export { OFFLINE_FEATURES };
