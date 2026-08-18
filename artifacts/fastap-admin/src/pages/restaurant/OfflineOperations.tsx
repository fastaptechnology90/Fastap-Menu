import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CloudOff, Save, Check, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";

export default function OfflineOperations() {
  const { restaurantId } = useRestaurant();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.offline(restaurantId).then(setSettings).catch(() => {});
  };

  useEffect(load, [restaurantId]);

  async function save() {
    if (!restaurantId || !settings) return;
    setSaving(true);
    await platformApi.updateOffline(restaurantId, settings).catch(() => {});
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
    return <div className="p-6 flex items-center gap-2 text-white/40"><Loader className="h-4 w-4 animate-spin" />Loading offline settings…</div>;
  }

  const toggles = [
    { key: "offlinePosEnabled", label: "Offline POS", desc: "Continue billing when internet drops" },
    { key: "offlineOrderingEnabled", label: "Offline Ordering", desc: "Queue guest orders locally" },
    { key: "autoSyncEnabled", label: "Auto Sync Recovery", desc: "Push queued data when back online" },
    { key: "lowBandwidthMode", label: "Low Bandwidth Mode", desc: "Reduce payload size for slow networks" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Offline Mode & Failover</h1>
          <p className="text-xs text-white/40">POS offline recovery, order sync & bandwidth controls</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync Now
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-bold">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending Sync", value: settings.pendingOrders ?? 0, icon: CloudOff, color: "text-amber-400" },
          { label: "Last Sync", value: settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleTimeString() : "Never", icon: RefreshCw, color: "text-emerald-400" },
          { label: "Sync Interval", value: `${settings.syncIntervalMinutes ?? 5} min`, icon: WifiOff, color: "text-blue-400" },
          { label: "Features", value: settings.catalog?.features?.length ?? 4, icon: CloudOff, color: "text-violet-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className="text-lg font-extrabold">{s.value}</p>
            <p className="text-xs text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <h3 className="font-bold">Offline Controls</h3>
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-white/40">{t.desc}</p>
            </div>
            <button
              onClick={() => setSettings((s: any) => ({ ...s, [t.key]: !s[t.key] }))}
              className={`h-7 w-12 rounded-full transition-all ${settings[t.key] ? "bg-emerald-500" : "bg-white/20"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[t.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
        <div>
          <label className="text-xs text-white/40 uppercase tracking-wide">Sync interval (minutes)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.syncIntervalMinutes ?? 5}
            onChange={e => setSettings((s: any) => ({ ...s, syncIntervalMinutes: parseInt(e.target.value, 10) || 5 }))}
            className="mt-1.5 w-full max-w-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
