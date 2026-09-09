import { useState, useEffect } from "react";
import { RefreshCw, Link2, CheckCircle, Loader, Bike, Globe, Package, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { FEATURES } from "@/lib/featureFlags";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";

const LOGO: Record<string, LucideIcon> = { swiggy: Bike, zomato: Utensils, ondc: Globe };

export default function AggregatorIntegrations() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      toast({
        title: `${id.toUpperCase()} order #${res?.order?.id ?? ""} ingested`,
        description: "It now appears in the kitchen app, Live Orders and Finance.",
      });
    } catch (e) {
      toast({ title: "Ingest failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setIngesting(null); }
  }

  const load = () => {
    if (!restaurantId) return;
    setLoading(true);
    platformApi.aggregators(restaurantId)
      .then(d => { setList(Array.isArray(d) ? d : []); setLoadError(null); })
      // An empty grid used to be indistinguishable from a failed request.
      .catch(e => setLoadError(e instanceof Error ? e.message : "Could not reach the integrations service."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [restaurantId]);

  async function toggle(id: string, enabled: boolean) {
    if (!restaurantId) return;
    try {
      await platformApi.updateAggregator(restaurantId, id, { enabled });
      toast({ title: enabled ? `${id.toUpperCase()} enabled` : `${id.toUpperCase()} disabled` });
      load();
    } catch (e) {
      toast({ title: "Could not change the integration", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function sync(id: string) {
    if (!restaurantId) return;
    setSyncing(id);
    try {
      await platformApi.syncAggregator(restaurantId, id);
      toast({ title: `${id.toUpperCase()} synced` });
      load();
    } catch (e) {
      toast({ title: "Sync failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Aggregator Integrations</h1>
        <p className="text-xs text-muted-foreground">Swiggy, Zomato & ONDC — sync-only (orders & menu catalog)</p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg border border-danger-border bg-danger-subtle p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-danger">We could not load your integrations. {loadError}</p>
          <button onClick={load} className="shrink-0 px-3 py-1.5 rounded-lg bg-danger-subtle text-danger text-xs font-semibold">Try again</button>
        </div>
      )}

      {!loading && !loadError && list.length === 0 && (
        <EmptyState
          title="No aggregators connected"
          description="Swiggy, Zomato and ONDC appear here once their partner API keys are configured."
        />
      )}

      <div className="grid gap-4">
        {list.map(agg => (
          <div key={agg.id} className="rounded-lg bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              {(() => { const Logo = LOGO[agg.id] || Package; return <Logo className="h-7 w-7 text-muted-foreground" />; })()}
              <div>
                <p className="font-semibold">{agg.name}</p>
                <p className="text-xs text-muted-foreground">Mode: {agg.syncMode?.replace("_", " ") || "orders & menu"}</p>
                {agg.lastSync && <p className="text-xs text-muted-foreground mt-0.5">Last sync: {new Date(agg.lastSync).toLocaleString()}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${agg.status === "connected" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}>
                {agg.status || "disconnected"}
              </span>
              <button
                onClick={() => toggle(agg.id, !agg.enabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${agg.enabled ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}
              >
                {agg.enabled ? "Enabled" : "Enable"}
              </button>
              <button
                onClick={() => sync(agg.id)}
                disabled={!agg.enabled || syncing === agg.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-semibold disabled:opacity-40"
              >
                {syncing === agg.id ? <Loader className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync
              </button>
              {FEATURES.aggregatorIngest && (
                <button
                  onClick={() => simulateOrder(agg.id)}
                  disabled={ingesting === agg.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold disabled:opacity-40"
                >
                  {ingesting === agg.id ? <Loader className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Simulate Order
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-info-subtle border border-info-border p-4 flex gap-3">
        <Link2 className="h-5 w-5 text-info shrink-0" />
        <p className="text-xs text-info">Integrations are read-only sync — orders flow in, menu updates push out. Configure API keys in aggregator partner portals.</p>
      </div>
    </div>
  );
}
