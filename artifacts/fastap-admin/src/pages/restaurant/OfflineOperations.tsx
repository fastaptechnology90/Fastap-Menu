import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CloudOff, Save, Check, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function OfflineOperations() {
  const { restaurantId } = useRestaurant();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.offline(restaurantId).then(setSettings).catch(e => toast({ title: "Could not load the offline settings", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
  };

  useEffect(load, [restaurantId]);

  async function save() {
    if (!restaurantId || !settings) return;
    setSaving(true);
    try {
      await platformApi.updateOffline(restaurantId, settings);
    } catch (e) {
      toast({ title: "Offline settings not saved", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function syncNow() {
    if (!restaurantId) return;
    setSyncing(true);
    const d = await platformApi.syncOffline(restaurantId).catch(() => null);
    if (d) setSettings((s: any) => ({ ...s, ...d }));
    setSyncing(false);
  }

  if (!settings) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader className="h-4 w-4 animate-spin" />Loading offline settings…</div>;
  }

  const toggles = [
    { key: "offlinePosEnabled", label: "Offline POS", desc: "Continue billing when internet drops" },
    { key: "offlineOrderingEnabled", label: "Offline Ordering", desc: "Queue guest orders locally" },
    { key: "autoSyncEnabled", label: "Auto Sync Recovery", desc: "Push queued data when back online" },
    { key: "lowBandwidthMode", label: "Low Bandwidth Mode", desc: "Reduce payload size for slow networks" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Offline Mode & Failover</h1>
          <p className="text-xs text-muted-foreground">POS offline recovery, order sync & bandwidth controls</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted text-sm font-semibold hover-elevate disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync Now
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending Sync", value: settings.pendingOrders ?? 0, icon: CloudOff, color: "text-primary" },
          { label: "Last Sync", value: settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleTimeString() : "Never", icon: RefreshCw, color: "text-success" },
          { label: "Sync Interval", value: `${settings.syncIntervalMinutes ?? 5} min`, icon: WifiOff, color: "text-info" },
          { label: "Features", value: settings.catalog?.features?.length ?? 4, icon: CloudOff, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-card border border-border p-4">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className="text-lg font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-card border border-border p-5 space-y-4">
        <h3 className="font-semibold">Offline Controls</h3>
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </div>
            <button
              onClick={() => setSettings((s: any) => ({ ...s, [t.key]: !s[t.key] }))}
              className={`h-7 w-12 rounded-full transition-colors ${settings[t.key] ? "bg-success" : "bg-muted"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[t.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Sync interval (minutes)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.syncIntervalMinutes ?? 5}
            onChange={e => setSettings((s: any) => ({ ...s, syncIntervalMinutes: parseInt(e.target.value, 10) || 5 }))}
            className="mt-1.5 w-full max-w-xs bg-muted border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
