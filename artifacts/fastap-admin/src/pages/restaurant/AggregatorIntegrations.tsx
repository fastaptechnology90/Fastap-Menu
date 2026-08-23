import { useState, useEffect } from "react";
import { RefreshCw, Link2, CheckCircle, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { FEATURES } from "@/lib/featureFlags";

const LOGO: Record<string, string> = { swiggy: "🟠", zomato: "🔴", ondc: "🌐" };

export default function AggregatorIntegrations() {
  const { restaurantId } = useRestaurant();
  const [list, setList] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);

  // WIP: simulate a Swiggy/Zomato order arriving. Once the partner API keys are wired,
  // their webhook POSTs to the same ingest endpoint — nothing else changes downstream.
  async function simulateOrder(id: string) {
    if (!restaurantId) return;
    setIngesting(id);
    try {
      const res = await platformApi.ingestAggregatorOrder(restaurantId, id, {
        customerName: `${id} customer`,
        items: [{ name: "Butter Chicken", qty: 1, price: 320 }, { name: "Garlic Naan", qty: 2, price: 40 }],
        notes: "Simulated incoming order",
      });
      alert(`✅ ${id.toUpperCase()} order #${res?.order?.id ?? ""} ingested — ab Kitchen app + Order Management + Finance sab me dikhega.`);
    } catch { alert("Ingest failed"); }
    finally { setIngesting(null); }
  }

  const load = () => {
    if (!restaurantId) return;
    platformApi.aggregators(restaurantId).then(d => setList(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(load, [restaurantId]);

  async function toggle(id: string, enabled: boolean) {
    if (!restaurantId) return;
    await platformApi.updateAggregator(restaurantId, id, { enabled }).catch(() => {});
    load();
  }

  async function sync(id: string) {
    if (!restaurantId) return;
    setSyncing(id);
    await platformApi.syncAggregator(restaurantId, id).catch(() => {});
    load();
    setSyncing(null);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">Aggregator Integrations</h1>
        <p className="text-xs text-white/40">Swiggy, Zomato & ONDC — sync-only (orders & menu catalog)</p>
      </div>

      <div className="grid gap-4">
        {list.map(agg => (
          <div key={agg.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-3xl">{LOGO[agg.id] || "📦"}</span>
              <div>
                <p className="font-bold">{agg.name}</p>
                <p className="text-xs text-white/40">Mode: {agg.syncMode?.replace("_", " ") || "orders & menu"}</p>
                {agg.lastSync && <p className="text-xs text-white/30 mt-0.5">Last sync: {new Date(agg.lastSync).toLocaleString()}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${agg.status === "connected" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                {agg.status || "disconnected"}
              </span>
              <button
                onClick={() => toggle(agg.id, !agg.enabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${agg.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}`}
              >
                {agg.enabled ? "Enabled" : "Enable"}
              </button>
              <button
                onClick={() => sync(agg.id)}
                disabled={!agg.enabled || syncing === agg.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold disabled:opacity-40"
              >
                {syncing === agg.id ? <Loader className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync
              </button>
              {FEATURES.aggregatorIngest && (
                <button
                  onClick={() => simulateOrder(agg.id)}
                  disabled={ingesting === agg.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold disabled:opacity-40"
                >
                  {ingesting === agg.id ? <Loader className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Simulate Order
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 flex gap-3">
        <Link2 className="h-5 w-5 text-blue-400 shrink-0" />
        <p className="text-xs text-blue-200/80">Integrations are read-only sync — orders flow in, menu updates push out. Configure API keys in aggregator partner portals.</p>
      </div>
    </div>
  );
}
