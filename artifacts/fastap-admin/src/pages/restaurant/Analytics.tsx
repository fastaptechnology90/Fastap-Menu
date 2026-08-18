import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { analytics as analyticsApi } from "@/lib/api";
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
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("week");
  const [summary, setSummary] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [paymentMix, setPaymentMix] = useState<any[]>([]);
  const [customerSegments, setCustomerSegments] = useState<any[]>([]);
  const [hourlyOrders, setHourlyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const published = isRestaurantPublished && (summary?.isPublished !== false);

  async function handleExport() {
    if (!restaurantId) return;
    setExporting(true);
    try { await analyticsApi.exportCsv(restaurantId); } catch {} finally { setExporting(false); }
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
    Promise.all([
      analyticsApi.summary(restaurantId, period).catch(() => null),
      analyticsApi.popularItems(restaurantId).catch(() => []),
      analyticsApi.dailySales(restaurantId, period).catch(() => []),
      analyticsApi.orderStats(restaurantId, period).catch(() => null),
    ]).then(([sum, items, sales, stats]) => {
      setSummary(sum);
      setTopItems(Array.isArray(items) ? items.map((i: any) => ({
        name: i.name,
        orders: i.totalOrders || 0,
        revenue: i.totalRevenue || 0,
        rating: i.avgRating ?? 0,
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
  }, [restaurantId, period, isRestaurantPublished]);

  const periodLabel = published ? (summary?.periodLabel || "All time") : "—";
  const displaySummary = (published && summary) ? summary : emptyAnalyticsSummaryDisplay(periodLabel);
  const kpiMetrics = [
    { label: "Total Revenue", value: `₹${Math.round((displaySummary.totalRevenue || 0) / 1000)}K`, sub: periodLabel, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Total Orders", value: String(displaySummary.totalOrders || 0), sub: periodLabel, icon: ShoppingBag, color: "text-orange-400" },
    { label: "Avg Order Value", value: `₹${Math.round(displaySummary.avgOrderValue || 0)}`, sub: "Per order", icon: TrendingUp, color: "text-blue-400" },
    { label: "Customer Rating", value: displaySummary.feedbackAvgRating ? `${displaySummary.feedbackAvgRating}★` : "0", sub: `${displaySummary.totalCustomers || 0} customers`, icon: Star, color: "text-yellow-400" },
    { label: "QR Scans", value: String(displaySummary.qrScans || 0), sub: "Total scans", icon: Users, color: "text-violet-400" },
    { label: "Reviews", value: String(displaySummary.reviews || 0), sub: "Total reviews", icon: Users, color: "text-pink-400" },
  ];

  if (loading) return <div className="p-6 text-center text-white/40 text-sm">Loading analytics…</div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Analytics & Reports</h1>
          <p className="text-xs text-white/40">Comprehensive performance insights</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
            {(["today", "week", "month", "year"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${period === p ? "bg-amber-500 text-white" : "text-white/50 hover:text-white"}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting || !published} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-all disabled:opacity-50">
            <Download className="h-4 w-4 text-amber-400" /> {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      {!published && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">Analytics unavailable</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiMetrics.map(metric => (
          <div key={metric.label} className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <div className="flex items-center justify-between mb-2">
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </div>
            <p className={`text-xl font-extrabold ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{metric.label}</p>
            <p className="text-xs text-white/25 mt-0.5">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold mb-1">Weekly Revenue</h3>
          <p className="text-xs text-white/40 mb-4">Daily breakdown · ₹{(published ? dailySales.reduce((s,d)=>s+d.revenue,0) : 0).toLocaleString()} total</p>
          {published && dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailySales}>
              <defs>
                <linearGradient id="aRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#ffffff40" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fill="url(#aRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <EmptyState title={published ? "No revenue data" : "No data available yet"} />
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold mb-1">Peak Hours</h3>
          <p className="text-xs text-white/40 mb-4">Orders by hour</p>
          {published && hourlyOrders.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyOrders}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#ffffff40" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <EmptyState title={published ? "No hourly data" : "No data available yet"} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold mb-4">Payment Methods</h3>
          {published && paymentMix.length > 0 ? (
          <div className="space-y-3">
            {paymentMix.map(p => (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">{p.name}</span>
                  <span className="font-semibold" style={{ color: p.color }}>{p.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.value}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
          </div>
          ) : (
            <EmptyState title={published ? "No payment data" : "No data available yet"} />
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold mb-4">Customer Segments</h3>
          {published && customerSegments.length > 0 ? (
          <div className="space-y-3">
            {customerSegments.map(seg => (
              <div key={seg.segment} className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${seg.bg} flex items-center justify-center text-lg shrink-0`}>
                  {seg.percent}%
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{seg.segment}</span>
                    <span className={`font-bold ${seg.color}`}>{seg.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
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

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="font-bold">Top Performing Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/5 bg-white/[0.02]">
                {["#", "Item Name", "Orders", "Revenue", "Avg Rating", "Growth"].map(h => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {published && topItems.length > 0 ? topItems.map((item, i) => (
                <tr key={item.name} className="hover:bg-white/3 transition-all">
                  <td className="px-5 py-3.5 text-white/30 font-bold">#{i + 1}</td>
                  <td className="px-5 py-3.5 font-semibold">{item.name}</td>
                  <td className="px-5 py-3.5 text-white/60">{item.orders}</td>
                  <td className="px-5 py-3.5 font-bold text-amber-400">₹{item.revenue.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    {item.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{item.rating}</span>
                      </div>
                    ) : (
                      <span className="text-white/30">0</span>
                    )}
                  </td>
                  <td className={`px-5 py-3.5 font-semibold ${item.growth?.startsWith("-") ? "text-red-400" : item.growth === "0%" ? "text-white/30" : "text-emerald-400"}`}>{item.growth}</td>
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
