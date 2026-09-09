import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { restaurantApi } from "@/lib/api";
import { CalendarRange, Loader2, IndianRupee } from "lucide-react";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Custom-date revenue widget for the restaurant panels (owner / cashier / finance /
 * cash-counter). Presets + a custom From–To range. Uses the shared PAID-order revenue
 * endpoint so the number matches every other panel.
 */
export function RevenueByDate({ restaurantId, title = "Revenue" }: { restaurantId?: number | null; title?: string }) {
  const today = new Date();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const PRESETS = [
    { key: "today", label: "Today", from: ymd(today), to: ymd(today) },
    { key: "7d", label: "7 days", from: ymd(daysAgo(6)), to: ymd(today) },
    { key: "15d", label: "15 days", from: ymd(daysAgo(14)), to: ymd(today) },
    { key: "30d", label: "30 days", from: ymd(daysAgo(29)), to: ymd(today) },
    { key: "all", label: "All time" as string, from: undefined as string | undefined, to: undefined as string | undefined },
  ];
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(today));

  const isAll = preset === "all";
  const params = isAll ? {} : { from, to };
  const { data, isFetching } = useQuery({
    queryKey: ["restaurant-revenue", restaurantId, isAll ? "all" : from, isAll ? "all" : to],
    queryFn: () => restaurantApi.revenue(Number(restaurantId), params),
    enabled: !!restaurantId,
    // Auto-refresh so collected amounts show up without a manual page refresh.
    refetchInterval: 12000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.key);
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="lg:w-56 shrink-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> {title} {data?.from ? `(${data.from}${data.to && data.to !== data.from ? ` → ${data.to}` : ""})` : "(all time)"}</p>
          <p className="text-3xl font-semibold text-success mt-1">
            {isFetching ? <Loader2 className="h-6 w-6 animate-spin" /> : `₹${Number(data?.revenue ?? 0).toLocaleString("en-IN")}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{data?.totalOrders ?? 0} orders in range</p>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${preset === p.key ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setPreset("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${preset === "custom" ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}>
              <CalendarRange className="h-3.5 w-3.5" /> Custom
            </button>
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">From</span>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground [color-scheme:dark]" />
              <span className="text-muted-foreground">To</span>
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground [color-scheme:dark]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
