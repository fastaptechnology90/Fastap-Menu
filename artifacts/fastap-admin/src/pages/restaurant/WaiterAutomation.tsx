import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCircle, Loader, RefreshCw, UtensilsCrossed, Receipt, HelpCircle, Droplets } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { waiterCalls } from "@/lib/api";

const TYPE_CFG: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  waiter: { label: "Call Waiter", icon: Bell, color: "text-amber-400" },
  bill: { label: "Bill Request", icon: Receipt, color: "text-emerald-400" },
  water: { label: "Water Refill", icon: Droplets, color: "text-blue-400" },
  assistance: { label: "Assistance", icon: HelpCircle, color: "text-violet-400" },
  order: { label: "Order Help", icon: UtensilsCrossed, color: "text-orange-400" },
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
    await waiterCalls.resolve(restaurantId, id).catch(() => {});
    await load();
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Waiter Automation</h1>
          <p className="text-xs text-white/40">Live table requests — bill, water, assistance</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Calls", value: calls.length, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Bill Requests", value: calls.filter(c => c.type === "bill").length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Waiter Calls", value: calls.filter(c => c.type === "waiter").length, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Other", value: calls.filter(c => !["bill", "waiter"].includes(c.type)).length, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-white/40 text-sm"><Loader className="h-4 w-4 animate-spin" />Loading requests...</div>}

      <div className="space-y-3">
        {calls.map(call => {
          const cfg = TYPE_CFG[call.type] || TYPE_CFG.waiter;
          const Icon = cfg.icon;
          return (
            <div key={call.id} className="bg-[#0e1520] border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold">{cfg.label}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">Table {call.tableName || call.tableId || "—"}</span>
                  <span className="text-xs text-white/30">{call.createdAt ? timeAgo(call.createdAt) : ""}</span>
                </div>
                {call.message && <p className="text-sm text-white/60 mt-1">{call.message}</p>}
              </div>
              <button onClick={() => resolve(call.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 shrink-0">
                <CheckCircle className="h-3.5 w-3.5" /> Resolve
              </button>
            </div>
          );
        })}
        {!loading && calls.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <Bell className="h-12 w-12 mx-auto mb-3 text-white/15" />
            <p>No active table requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
