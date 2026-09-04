import { useLocation } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { analytics as analyticsApi, restaurantApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import {
  TrendingUp, ShoppingBag, Users, Grid3x3, AlertTriangle,
  Star, Clock
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function formatRevenue(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString()}`;
}

// Small payment-method chip so the dashboard's Live Orders show how each order was paid.
const PAY_CHIP: Record<string, { label: string; cls: string }> = {
  upi: { label: "UPI", cls: "bg-emerald-500/15 text-emerald-400" },
  cash: { label: "Cash", cls: "bg-amber-500/15 text-amber-400" },
  card: { label: "Card", cls: "bg-blue-500/15 text-blue-400" },
  room_bill: { label: "Room", cls: "bg-cyan-500/15 text-cyan-400" },
  aggregator: { label: "Aggr", cls: "bg-pink-500/15 text-pink-400" },
  wallet: { label: "Wallet", cls: "bg-pink-500/15 text-pink-400" },
};
function payChip(mode?: string) {
  // Same as the order list: an order with no method has not been paid yet.
  if (!mode) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-white/10 text-white/40">Unpaid</span>;
  }
  const m = mode.toLowerCase();
  const c = PAY_CHIP[m] || ((m.includes("gateway") || m.includes("online") || m.includes("razor"))
    ? { label: "Gateway", cls: "bg-violet-500/15 text-violet-400" }
    : { label: mode || "Cash", cls: "bg-white/10 text-white/50" });
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${c.cls}`}>{c.label}</span>;
}

export default function RestaurantDashboard() {
  const [, navigate] = useLocation();
  const { liveOrders, tables, restaurant, currentStaff, staffList, restaurantId, isRestaurantPublished } = useRestaurant();
  const [dashboard, setDashboard] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<{ time: string; revenue: number }[]>([]);
  const [selOrder, setSelOrder] = useState<typeof liveOrders[0] | null>(null);
  const [topItems, setTopItems] = useState<{ name: string; orders: number; revenue: number; trend: string }[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Trust the dashboard API's publication flag once it has loaded (it's authoritative and
  // already applies the gate); fall back to the context only while it's still loading. This
  // stops the panel showing "unpublished / ₹0" when the context flag is briefly stale.
  const published = dashboard ? dashboard.isPublished !== false : isRestaurantPublished;

  const loadDashboardData = useCallback(async () => {
    if (!restaurantId) return;
    const dash = await restaurantApi.dashboard(restaurantId).catch(() => null);
    if (dash) setDashboard(dash);

    const apiPublished = dash ? dash.isPublished !== false : isRestaurantPublished;
    if (!apiPublished) {
      setRevenueData([]);
      setTopItems([]);
      setLastRefresh(new Date());
      return;
    }

    const [sales, items] = await Promise.all([
      analyticsApi.dailySales(restaurantId).catch(() => []),
      analyticsApi.popularItems(restaurantId).catch(() => []),
    ]);
    const chartRows = Array.isArray(sales) ? sales : [];
    setRevenueData(chartRows.slice(-12).map((s: any) => ({
      time: s.date?.slice(5) || s.date || "—",
      revenue: s.revenue || 0,
    })));
    const itemRows = Array.isArray(items) ? items : [];
    setTopItems(itemRows.map((i: any) => ({
      name: i.name,
      orders: i.totalOrders || 0,
      revenue: i.totalRevenue || 0,
      trend: i.growth || "0%",
    })));
    setLastRefresh(new Date());
  }, [restaurantId, isRestaurantPublished]);

  useEffect(() => {
    if (!restaurantId) return;
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15_000);
    return () => clearInterval(interval);
  }, [restaurantId, loadDashboardData]);

  const todayRevenue = published ? (dashboard?.todayRevenue ?? 0) : 0;
  const weekRevenue = published ? (dashboard?.weekRevenue ?? 0) : 0;
  const fortnightRevenue = published ? (dashboard?.fortnightRevenue ?? 0) : 0;
  const monthRevenue = published ? (dashboard?.monthRevenue ?? 0) : 0;
  const weekOrderCount = published ? (dashboard?.weekOrders ?? 0) : 0;
  const fortnightOrderCount = published ? (dashboard?.fortnightOrders ?? 0) : 0;
  const monthOrderCount = published ? (dashboard?.monthOrders ?? 0) : 0;
  const occupiedTables = tables.filter(t => t.status === "occupied" || t.status === "billing").length;
  const activeOrders = published
    ? (dashboard?.activeOrders ?? 0)
    : 0;
  const newOrders = published ? liveOrders.filter(o => o.status === "new").length : 0;
  const readyOrders = published ? liveOrders.filter(o => o.status === "ready").length : 0;
  const lowStockItems = dashboard?.lowStockItems ?? 0;
  const avgRating = published ? (dashboard?.avgRating ?? 0) : 0;
  const walletBalance = published ? (dashboard?.walletBalance ?? 0) : 0;
  const pendingSettlements = published ? (dashboard?.pendingSettlements ?? 0) : 0;
  const vipCustomers = published ? (dashboard?.vipCustomers ?? 0) : 0;
  const activeWaiterCalls = published ? (dashboard?.activeWaiterCalls ?? 0) : 0;

  const sectionOccupancy = (() => {
    if (tables.length === 0) return [];
    const bySection = new Map<string, { total: number; occupied: number }>();
    for (const t of tables) {
      const sec = t.section || "Main Hall";
      const cur = bySection.get(sec) ?? { total: 0, occupied: 0 };
      cur.total += 1;
      if (t.status === "occupied" || t.status === "billing" || t.status === "reserved") cur.occupied += 1;
      bySection.set(sec, cur);
    }
    return [...bySection.entries()].map(([name, v]) => ({ name, ...v }));
  })();

  const todayOrders = published ? (dashboard?.todayOrders ?? 0) : 0;
  const avgOrderValue = published ? (dashboard?.avgOrderValue ?? 0) : 0;
  const loyaltyCustomers = published ? (dashboard?.loyaltyCustomers ?? 0) : 0;
  const pendingReservations = published ? (dashboard?.pendingReservations ?? 0) : 0;

  // The Revenue card shows "This Month" — for any other period use the "Revenue by date"
  // widget at the top of the page (custom-date). Old inline dropdown removed.
  const KPI_CARDS = [
    { label: "Today's Revenue", value: formatRevenue(todayRevenue), sub: `${todayOrders} orders · Week ${formatRevenue(weekRevenue)}`, icon: TrendingUp, color: "from-emerald-500/20 to-emerald-600/10", iconColor: "text-emerald-400" },
    { label: "Revenue", value: formatRevenue(monthRevenue), sub: `This Month · ${monthOrderCount} orders`, icon: ShoppingBag, color: "from-orange-500/20 to-orange-600/10", iconColor: "text-orange-400" },
    { label: "Table Occupancy", value: `${occupiedTables}/${restaurant.totalTables || tables.length}`, sub: `${restaurant.totalTables || tables.length ? Math.round(occupiedTables / (restaurant.totalTables || tables.length) * 100) : 0}% occupied`, icon: Grid3x3, color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400" },
    { label: "Active Orders", value: activeOrders, sub: `${newOrders} new · ${readyOrders} ready`, icon: Clock, color: "from-violet-500/20 to-violet-600/10", iconColor: "text-violet-400" },
    { label: "Wallet Balance", value: formatRevenue(walletBalance), sub: `Pending settlement ${formatRevenue(pendingSettlements)}`, icon: TrendingUp, color: "from-amber-500/20 to-amber-600/10", iconColor: "text-amber-400" },
    { label: "Customer Rating", value: avgRating || "0", sub: `${vipCustomers} VIP · ${loyaltyCustomers} loyalty`, icon: Star, color: "from-yellow-500/20 to-yellow-600/10", iconColor: "text-yellow-400" },
    { label: "Waiter Calls", value: activeWaiterCalls, sub: `${pendingReservations} reservations pending`, icon: AlertTriangle, color: "from-pink-500/20 to-pink-600/10", iconColor: "text-pink-400" },
    { label: "Low Stock Alerts", value: lowStockItems, sub: "Items need restock", icon: AlertTriangle, color: "from-red-500/20 to-red-600/10", iconColor: "text-red-400" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Good morning, {currentStaff?.name?.split(" ")[0]}! 👋</h1>
          <p className="text-white/40 text-sm mt-0.5">{restaurant.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-xs text-white/30 hidden sm:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${published ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-amber-400 bg-amber-400/10 border-amber-400/20"}`}>
            <span className={`h-2 w-2 rounded-full ${published ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            {published ? "Live · refreshes every 15s" : "Not published"}
          </div>
        </div>
      </div>

      <RevenueByDate restaurantId={restaurantId} title="Revenue" />

      {!published && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">No analytics yet</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {KPI_CARDS.map(card => (
          <div key={card.label} className={`rounded-2xl bg-gradient-to-br ${card.color} border border-white/8 p-4`}>
            <div className="flex items-start justify-between mb-3 gap-1">
              <card.icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-extrabold mb-1">{card.value}</p>
            <p className="text-xs text-white/40 leading-tight">{card.label}</p>
            <p className="text-xs text-white/30 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold">Revenue Trend</h3>
              <p className="text-xs text-white/40">Daily breakdown</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-emerald-400">₹{todayRevenue.toLocaleString()}</p>
              <p className="text-xs text-emerald-400">{todayOrders} orders today</p>
            </div>
          </div>
          {published && revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#ffffff40" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-white/30">
              {published ? "No sales data yet" : "No data available yet"}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Live Orders</h3>
            <button onClick={() => navigate("/restaurant/orders")} className="text-xs text-amber-400 hover:text-amber-300">View all →</button>
          </div>
          <div className="space-y-3">
            {!published || liveOrders.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-8">{published ? "No active orders" : "Orders appear after publication"}</p>
            ) : liveOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/8 transition-all cursor-pointer" onClick={() => setSelOrder(order)} title="Click for payment details">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${order.status === "new" ? "bg-orange-400 animate-pulse" : order.status === "ready" ? "bg-emerald-400 animate-pulse" : order.status === "preparing" ? "bg-blue-400" : "bg-white/30"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold">{order.tableNo}</span>
                    {payChip(order.paymentMethod)}
                    <span className="text-xs text-white/30">{order.id}</span>
                  </div>
                  <p className="text-xs text-white/40 truncate">{order.customerName ? `${order.customerName} · ` : ""}{order.items.map(i => i.name).join(", ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-400">₹{order.total}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${order.status === "new" ? "bg-orange-500/20 text-orange-400" : order.status === "ready" ? "bg-emerald-500/20 text-emerald-400" : order.status === "preparing" ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/40"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold mb-4">Top Selling Items</h3>
          <div className="space-y-3">
            {published && topItems.length > 0 ? topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-extrabold flex items-center justify-center shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-white/30">{item.orders} orders · ₹{item.revenue.toLocaleString()}</p>
                </div>
                <span className={`text-xs font-semibold ${item.trend?.startsWith("-") ? "text-red-400" : item.trend === "0%" ? "text-white/30" : "text-emerald-400"}`}>{item.trend}</span>
              </div>
            )) : (
              <p className="text-sm text-white/30 text-center py-6">{published ? "No item sales data yet" : "No data available yet"}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Section Occupancy</h3>
            <button onClick={() => navigate("/restaurant/tables")} className="text-xs text-amber-400">View →</button>
          </div>
          <div className="space-y-3">
            {sectionOccupancy.length === 0 ? <EmptyState title="No table sections loaded" /> : sectionOccupancy.map(sec => (
              <div key={sec.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/60">{sec.name}</span>
                  <span className="text-white/40">{sec.occupied}/{sec.total}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${sec.total ? (sec.occupied / sec.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Staff On Duty</h3>
            <button onClick={() => navigate("/restaurant/staff")} className="text-xs text-amber-400">View →</button>
          </div>
          <div className="space-y-2.5">
            {staffList.slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                    {s.role === "chef" ? "👨‍🍳" : s.role === "waiter" ? "🍽️" : s.role === "cashier" ? "💳" : s.role === "manager" ? "🏢" : "👤"}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1120] ${s.status === "active" ? "bg-emerald-400" : s.status === "on-break" ? "bg-yellow-400" : "bg-white/20"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{s.name}</p>
                  <p className="text-xs text-white/30 capitalize">{s.role} · {s.shift}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "active" ? "bg-emerald-500/20 text-emerald-400" : s.status === "on-break" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/30"}`}>
                  {s.status === "on-break" ? "Break" : s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lowStockItems > 0 && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">{lowStockItems} inventory items below minimum stock level</p>
              <p className="text-xs text-white/40 mt-0.5">Review inventory and reorder before service peaks</p>
            </div>
            <button onClick={() => navigate("/restaurant/inventory")} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-sm font-semibold transition-all shrink-0">
              View Inventory
            </button>
          </div>
        </div>
      )}

      {selOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelOrder(null)}>
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-bold">Payment details</h3>
              <button onClick={() => setSelOrder(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-extrabold text-amber-400">₹{Number(selOrder.total).toLocaleString("en-IN")}</p>
                <p className="text-xs text-white/40 mt-1">{selOrder.tableNo} · {selOrder.id}</p>
              </div>
              {[
                ["Payment method", String(selOrder.paymentMethod || "—").toUpperCase()],
                ["Pay status", selOrder.paymentStatus || "—"],
                ["UPI ID", selOrder.upiId || "—"],
                ["UTR / Reference", selOrder.utr || "—"],
                ["Collected by", selOrder.collectedBy || "—"],
                ["From panel", selOrder.collectedFrom || "—"],
                ["Customer", selOrder.customerName || "—"],
                ["Room", selOrder.roomNumber || "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-right break-all capitalize">{v as string}</span>
                </div>
              ))}
              <button onClick={() => { navigate("/restaurant/orders"); }} className="w-full py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5">Open in Order Management</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
