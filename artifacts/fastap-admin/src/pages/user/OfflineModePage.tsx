import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useOffline, OFFLINE_FEATURES } from "@/contexts/OfflineContext";
import { useUser } from "@/contexts/UserContext";
import { getCachedMenu } from "@/lib/offlineStorage";
import {
  ChevronLeft, Wifi, WifiOff, RefreshCw, Database, CloudOff,
  Signal, CheckCircle, Loader, HardDrive,
} from "lucide-react";

export default function OfflineModePage() {
  const [, navigate] = useAppLocation();
  const { venue } = useUser();
  const {
    isOnline, connectionStatus, settings, pendingOrders, menuCache, lastSyncAt,
    syncing, setLowBandwidthMode, setAutoSyncEnabled, syncPendingOrders, refreshStatus,
  } = useOffline();

  const [toast, setToast] = useState<string | null>(null);
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = venue.restaurantSlug || DEMO_SLUG;
  const cache = menuCache ?? getCachedMenu(slug);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  async function handleSync() {
    const res = await syncPendingOrders();
    if (res.synced > 0) showToast(`${res.synced} order(s) synced`);
    else if (pendingOrders.length === 0) showToast("Nothing to sync");
    else showToast("Sync failed — will retry automatically");
  }

  const statusColor = connectionStatus === "online" ? "text-success" : connectionStatus === "slow" ? "text-warning" : "text-danger";
  const StatusIcon = connectionStatus === "offline" ? WifiOff : Wifi;

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Offline Mode & Low Internet</p>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-info" /> Connection Optimizer
            </h1>
          </div>
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusColor} bg-muted`}>
            <StatusIcon className="h-3 w-3" />
            {connectionStatus}
          </div>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-success-border bg-success-subtle px-3 py-2 text-xs text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Connection status */}
        <div className="rounded-xl border border-info-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-info">
                {isOnline ? "Connected" : "You're offline"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {connectionStatus === "slow" ? "Slow connection detected — enable low bandwidth mode" : "Menu & orders work offline with auto-sync"}
              </p>
            </div>
            <button onClick={refreshStatus} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4 features overview */}
        <div className="grid grid-cols-2 gap-2">
          {OFFLINE_FEATURES.map(f => {
            const active =
              f.id === "offline_menu" ? Boolean(cache) :
              f.id === "offline_order_cache" ? pendingOrders.length > 0 :
              f.id === "auto_sync_recovery" ? settings.autoSyncEnabled :
              settings.lowBandwidthMode;
            return (
              <div key={f.id} className={`rounded-xl border p-3 ${active ? "border-info-border bg-info-subtle" : "border-border bg-muted"}`}>
                <span className="text-lg">{f.icon}</span>
                <p className="text-xs font-semibold mt-1">{f.label}</p>
                <p className="text-2xs text-muted-foreground line-clamp-2 mt-0.5">{f.desc}</p>
                {active && <p className="text-2xs text-info mt-1">Active</p>}
              </div>
            );
          })}
        </div>

        {/* Offline menu loading */}
        <div className="rounded-xl bg-muted border border-border p-4">
          <p className="text-sm font-semibold flex items-center gap-2 mb-3">
            <HardDrive className="h-4 w-4 text-info" /> Offline Menu Cache
          </p>
          {cache ? (
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>Restaurant: {slug}</p>
              <p>Items cached: {cache.itemCount ?? 0}</p>
              <p>Cached: {new Date(cache.cachedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Open the menu while online to cache it for offline browsing.</p>
          )}
        </div>

        {/* Offline order cache + auto sync */}
        <div className="rounded-xl bg-muted border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-warning" /> Pending Orders ({pendingOrders.length})
            </p>
            <button onClick={handleSync} disabled={syncing || pendingOrders.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg bg-info-subtle border border-info-border text-info disabled:opacity-40 flex items-center gap-1">
              {syncing ? <Loader className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sync now
            </button>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No queued orders — orders placed offline appear here until synced.</p>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map(o => (
                <div key={o.id} className="flex justify-between text-xs border-b border-border pb-2">
                  <span>{o.restaurantName ?? "Order"} · {o.itemCount ?? "?"} items</span>
                  <span className="text-warning">₹{o.total ?? "—"} · queued</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-2xs text-muted-foreground mt-2">
            Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
          </p>
        </div>

        {/* Low bandwidth + auto sync toggles */}
        <div className="rounded-xl bg-muted border border-border divide-y divide-border">
          <button onClick={() => setLowBandwidthMode(!settings.lowBandwidthMode)}
            className="w-full flex items-center justify-between p-4 text-left">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Signal className="h-4 w-4 text-primary" /> Low Bandwidth Mode
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Hide images & videos · saves ~80% data</p>
            </div>
            <div className={`w-11 h-6 rounded-full relative ${settings.lowBandwidthMode ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-all ${settings.lowBandwidthMode ? "left-5" : "left-0.5"}`} />
            </div>
          </button>
          <button onClick={() => setAutoSyncEnabled(!settings.autoSyncEnabled)}
            className="w-full flex items-center justify-between p-4 text-left">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-info" /> Auto Sync Recovery
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Sync cart & orders when connection returns</p>
            </div>
            <div className={`w-11 h-6 rounded-full relative ${settings.autoSyncEnabled ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-all ${settings.autoSyncEnabled ? "left-5" : "left-0.5"}`} />
            </div>
          </button>
        </div>
      </div>

      <div className="guest-bottom-bar">
        <button onClick={() => navigate("/user/menu")} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 font-semibold">
          {cache ? "Browse Cached Menu" : "Open Menu to Cache"}
        </button>
      </div>
    </div>
  );
}
