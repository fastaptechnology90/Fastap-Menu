import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Bell, CheckCircle, Loader, RefreshCw, UtensilsCrossed, Receipt, HelpCircle, Droplets } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { waiterCalls } from "@/lib/api";

const TYPE_CFG: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  waiter: { label: "Call Waiter", icon: Bell, color: "text-primary" },
  bill: { label: "Bill Request", icon: Receipt, color: "text-success" },
  water: { label: "Water Refill", icon: Droplets, color: "text-info" },
  assistance: { label: "Assistance", icon: HelpCircle, color: "text-muted-foreground" },
  order: { label: "Order Help", icon: UtensilsCrossed, color: "text-warning" },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  return `${mins}m ago`;
}

export default function WaiterAutomation() {
  const { restaurantId } = useRestaurant();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const rows = await waiterCalls.list(restaurantId);
      setCalls(Array.isArray(rows) ? rows : []);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: number) {
    if (!restaurantId) return;
    try {
      await waiterCalls.resolve(restaurantId, id);
    } catch (e) {
      // A call left unresolved on the server keeps buzzing the floor staff.
      toast({ title: "Could not close the call", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      return;
    }
    await load();
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Waiter Automation</h1>
          <p className="text-xs text-muted-foreground">Live table requests — bill, water, assistance</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted text-sm font-semibold hover-elevate">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Calls", value: calls.length, color: "text-primary", bg: "bg-primary/10" },
          { label: "Bill Requests", value: calls.filter(c => c.type === "bill").length, color: "text-success", bg: "bg-success-subtle" },
          { label: "Waiter Calls", value: calls.filter(c => c.type === "waiter").length, color: "text-warning", bg: "bg-warning-subtle" },
          { label: "Other", value: calls.filter(c => !["bill", "waiter"].includes(c.type)).length, color: "text-muted-foreground", bg: "bg-muted" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader className="h-4 w-4 animate-spin" />Loading requests...</div>}

      <div className="space-y-3">
        {calls.map(call => {
          const cfg = TYPE_CFG[call.type] || TYPE_CFG.waiter;
          const Icon = cfg.icon;
          return (
            <div key={call.id} className="bg-card border border-primary/20 rounded-lg p-4 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{cfg.label}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Table {call.tableName || call.tableId || "—"}</span>
                  <span className="text-xs text-muted-foreground">{call.createdAt ? timeAgo(call.createdAt) : ""}</span>
                </div>
                {call.message && <p className="text-sm text-muted-foreground mt-1">{call.message}</p>}
              </div>
              <button onClick={() => resolve(call.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate shrink-0">
                <CheckCircle className="h-3.5 w-3.5" /> Resolve
              </button>
            </div>
          );
        })}
        {!loading && calls.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>No active table requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
