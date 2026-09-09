import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { fmtINR } from "@/lib/format";
import { analytics as analyticsApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { publicationEmptyMessage, emptyAnalyticsSummaryDisplay } from "@/lib/restaurantPublication";
import {
  TrendingUp, Users, ShoppingBag, Star, Download
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function Analytics() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [period, setPeriod] = useState<"today" | "week" | "fortnight" | "month" | "year">("week");
  const [summary, setSummary] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [paymentMix, setPaymentMix] = useState<any[]>([]);
  const [customerSegments, setCustomerSegments] = useState<any[]>([]);
  const [hourlyOrders, setHourlyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const published = isRestaurantPublished && (summary?.isPublished !== false);

  async function handleExport() {
    if (!restaurantId) return;
    setExporting(true);
    try {
      await analyticsApi.exportCsv(restaurantId);
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setExporting(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    if (!isRestaurantPublished) {
      setSummary(emptyAnalyticsSummaryDisplay());
      setTopItems([]);
      setDailySales([]);
      setPaymentMix([]);
      setCustomerSegments([]);
      setHourlyOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // The summary carries every KPI on the page, so its failure is the one worth
    // reporting; the rest degrade into their own empty states.
    Promise.all([
      analyticsApi.summary(restaurantId, period).catch(e => { setLoadError(e instanceof Error ? e.message : "Could not reach the server."); return null; }),
      analyticsApi.popularItems(restaurantId).catch(() => []),
      analyticsApi.dailySales(restaurantId, period).catch(() => []),
      analyticsApi.orderStats(restaurantId, period).catch(() => null),
    ]).then(([sum, items, sales, stats]) => {
      if (sum) setLoadError(null);
      setSummary(sum);
      setTopItems(Array.isArray(items) ? items.map((i: any) => ({
        name: i.name,
        orders: i.totalOrders || 0,
        revenue: i.totalRevenue || 0,
        // Null means this dish has no rating of its own — it used to inherit the venue
        // average, so an unrated dish showed the same stars as a loved one.
        rating: i.avgRating ?? null,
        ratingCount: i.ratingCount ?? 0,
        growth: i.growth || "0%",
      })) : []);
      setDailySales(Array.isArray(sales) ? sales.map((s: any) => ({
        day: s.date?.slice(5) || s.date,
        revenue: s.revenue || 0,
        orders: s.orders || 0,
      })) : []);
      if (stats) {
        setPaymentMix(Array.isArray(stats.paymentMix) ? stats.paymentMix : []);
        setCustomerSegments(Array.isArray(stats.customerSegments) ? stats.customerSegments : []);
        setHourlyOrders(Array.isArray(stats.hourlyOrders) ? stats.hourlyOrders : []);
      } else {
        setPaymentMix([]);
        setCustomerSegments([]);
        setHourlyOrders([]);
      }
    }).finally(() => setLoading(false));
  }, [restaurantId, period, isRestaurantPublished, reloadKey]);

  const periodLabel = published ? (summary?.periodLabel || "All time") : "—";
  const displaySummary = (published && summary) ? summary : emptyAnalyticsSummaryDisplay(periodLabel);
  const kpiMetrics = [
    // Dividing by 1000 and rounding meant a venue taking ₹123 read "₹0K", and every
    // figure under half a lakh lost its precision. fmtINR carries the Indian units.
    { label: "Total Revenue", value: fmtINR(displaySummary.totalRevenue || 0), sub: periodLabel, icon: TrendingUp, color: "text-success" },
    { label: "Total Orders", value: String(displaySummary.totalOrders || 0), sub: periodLabel, icon: ShoppingBag, color: "text-warning" },
    { label: "Avg Order Value", value: fmtINR(displaySummary.avgOrderValue || 0), sub: "Per paid order", icon: TrendingUp, color: "text-info" },
    { label: "Customer Rating", value: displaySummary.feedbackAvgRating ? String(displaySummary.feedbackAvgRating) : "No reviews yet", sub: `${displaySummary.totalCustomers || 0} customers`, icon: Star, color: "text-warning" },
    { label: "QR Scans", value: String(displaySummary.qrScans || 0), sub: "Total scans", icon: Users, color: "text-muted-foreground" },
    { label: "Reviews", value: String(displaySummary.reviews || 0), sub: "Total reviews", icon: Users, color: "text-muted-foreground" },
  ];

  if (loading) return <div className="p-6 text-center text-muted-foreground text-sm">Loading analytics…</div>;

  if (loadError) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-lg border border-danger-border bg-danger-subtle p-5 text-center">
          <p className="text-sm font-semibold text-danger">We could not load your analytics.</p>
          <p className="mt-1 text-xs text-danger">{loadError} Nothing below would be accurate, so it is not shown.</p>
          <button onClick={() => setReloadKey(k => k + 1)} className="mt-4 px-4 py-2 rounded-lg bg-danger-subtle text-danger text-xs font-semibold">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Analytics & Reports</h1>
          <p className="text-xs text-muted-foreground">Comprehensive performance insights</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {([["today","Today"],["week","7 Days"],["fortnight","15 Days"],["month","30 Days"],["year","Year"]] as const).map(([p,label]) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting || !published} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover-elevate text-sm transition-colors disabled:opacity-50">
            <Download className="h-4 w-4 text-primary" /> {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      {!published && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm font-semibold text-primary">Analytics unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiMetrics.map(metric => (
          <div key={metric.label} className="rounded-lg bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </div>
            <p className={`text-xl font-semibold ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold mb-1">Weekly Revenue</h3>
          <p className="text-xs text-muted-foreground mb-4">Daily breakdown · ₹{(published ? dailySales.reduce((s,d)=>s+d.revenue,0) : 0).toLocaleString()} total</p>
          {published && dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailySales}>
              <defs>
                <linearGradient id="aRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#aRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <EmptyState title={published ? "No revenue data" : "No data available yet"} />
          )}
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold mb-1">Peak Hours</h3>
          <p className="text-xs text-muted-foreground mb-4">Orders by hour</p>
          {published && hourlyOrders.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyOrders}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <EmptyState title={published ? "No hourly data" : "No data available yet"} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold mb-4">Payment Methods</h3>
          {published && paymentMix.length > 0 ? (
          <div className="space-y-3">
            {paymentMix.map(p => (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="font-semibold" style={{ color: p.color }}>{p.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-colors" style={{ width: `${p.value}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
          </div>
          ) : (
            <EmptyState title={published ? "No payment data" : "No data available yet"} />
          )}
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold mb-4">Customer Segments</h3>
          {published && customerSegments.length > 0 ? (
          <div className="space-y-3">
            {customerSegments.map(seg => (
              <div key={seg.segment} className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${seg.bg} flex items-center justify-center text-lg shrink-0`}>
                  {seg.percent}%
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{seg.segment}</span>
                    <span className={`font-semibold ${seg.color}`}>{seg.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${seg.bg.replace("/20", "")}`} style={{ width: `${seg.percent}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <EmptyState title={published ? "No customer segments" : "No data available yet"} />
          )}
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Top Performing Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border bg-card">
                {["#", "Item Name", "Orders", "Revenue", "Avg Rating", "Growth"].map(h => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {published && topItems.length > 0 ? topItems.map((item, i) => (
                <tr key={item.name} className="hover:bg-muted transition-colors">
                  <td className="px-5 py-3.5 text-muted-foreground font-semibold">#{i + 1}</td>
                  <td className="px-5 py-3.5 font-semibold">{item.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{item.orders}</td>
                  <td className="px-5 py-3.5 font-semibold text-primary">₹{item.revenue.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5">
                    {item.rating != null && item.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        <span className="font-semibold">{item.rating}</span>
                        <span className="text-muted-foreground text-xs">({item.ratingCount})</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not rated</span>
                    )}
                  </td>
                  <td className={`px-5 py-3.5 font-semibold ${item.growth?.startsWith("-") ? "text-danger" : item.growth === "0%" ? "text-muted-foreground" : "text-success"}`}>{item.growth}</td>
                </tr>
              )) : (
                <tr><td colSpan={6}><EmptyState title={published ? "No item performance data" : "No data available yet"} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
