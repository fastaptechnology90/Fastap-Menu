import { useLocation } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { analytics as analyticsApi, restaurantApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { Badge } from "@/components/ui/badge";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import {
  TrendingUp, ShoppingBag, Users, Grid3x3, AlertTriangle,
  Star, Clock, Wallet, ArrowRight, ChefHat, UtensilsCrossed, CreditCard, Building2, User } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// The owner reads these tiles as their books, not as a headline. "₹47.9K" hides up to
// ₹99 of takings and cannot be reconciled against anything, so print the rupee figure.
function formatRevenue(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Small payment-method chip so the dashboard's Live Orders show how each order was paid.
const PAY_CHIP: Record<string, string> = {
  upi: "UPI",
  cash: "Cash",
  card: "Card",
  room_bill: "Room",
  aggregator: "Aggregator",
  wallet: "Wallet",
};
function payChip(mode?: string) {
  // Same as the order list: an order with no method has not been paid yet.
  if (!mode) {
    return <Badge variant="warning" className="text-2xs">Unpaid</Badge>;
  }
  const m = mode.toLowerCase();
  const label = PAY_CHIP[m]
    || ((m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway" : mode);
  return <Badge variant="muted" className="text-2xs">{label}</Badge>;
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
    { label: "Today's Revenue", value: formatRevenue(todayRevenue), sub: `${todayOrders} orders · Week ${formatRevenue(weekRevenue)}`, icon: TrendingUp, iconColor: "text-muted-foreground" },
    { label: "Revenue", value: formatRevenue(monthRevenue), sub: `This Month · ${monthOrderCount} orders`, icon: ShoppingBag, iconColor: "text-muted-foreground" },
    { label: "Table Occupancy", value: `${occupiedTables}/${restaurant.totalTables || tables.length}`, sub: `${restaurant.totalTables || tables.length ? Math.round(occupiedTables / (restaurant.totalTables || tables.length) * 100) : 0}% occupied`, icon: Grid3x3, iconColor: "text-muted-foreground" },
    { label: "Active Orders", value: activeOrders, sub: `${newOrders} new · ${readyOrders} ready`, icon: Clock, iconColor: "text-muted-foreground" },
    { label: "Wallet Balance", value: formatRevenue(walletBalance), sub: `Pending settlement ${formatRevenue(pendingSettlements)}`, icon: TrendingUp, iconColor: "text-muted-foreground" },
    { label: "Customer Rating", value: avgRating || "0", sub: `${vipCustomers} VIP · ${loyaltyCustomers} loyalty`, icon: Star, iconColor: "text-muted-foreground" },
    { label: "Waiter Calls", value: activeWaiterCalls, sub: `${pendingReservations} reservations pending`, icon: AlertTriangle, iconColor: "text-muted-foreground" },
    { label: "Low Stock Alerts", value: lowStockItems, sub: "Items need restock", icon: AlertTriangle, iconColor: lowStockItems > 0 ? "text-danger" : "text-muted-foreground" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">{greetingFor(new Date().getHours())}, {currentStaff?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{restaurant.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${published ? "text-success bg-success-subtle border-success-border" : "text-primary bg-primary/10 border-primary/20"}`}>
            <span className={`h-2 w-2 rounded-full ${published ? "bg-success animate-pulse" : "bg-primary"}`} />
            {published ? "Live · refreshes every 15s" : "Not published"}
          </div>
        </div>
      </div>

      <RevenueByDate restaurantId={restaurantId} title="Revenue" />

      {!published && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm font-semibold text-primary">No analytics yet</p>
          <p className="text-xs text-muted-foreground mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {KPI_CARDS.map(card => (
          <div key={card.label} className="min-w-0 rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 shrink-0 ${card.iconColor}`} aria-hidden="true" />
              <p className="truncate text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-lg bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Revenue Trend</h3>
              <p className="text-xs text-muted-foreground">Daily breakdown</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-success">₹{todayRevenue.toLocaleString()}</p>
              <p className="text-xs text-success">{todayOrders} orders today</p>
            </div>
          </div>
          {published && revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
              {published ? "No sales data yet" : "No data available yet"}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Live Orders</h3>
            <button onClick={() => navigate("/restaurant/orders")} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">View all<ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="space-y-3">
            {!published || liveOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{published ? "No active orders" : "Orders appear after publication"}</p>
            ) : liveOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted hover-elevate transition-colors cursor-pointer" onClick={() => setSelOrder(order)} title="Click for payment details">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${order.status === "new" ? "bg-warning animate-pulse" : order.status === "ready" ? "bg-success animate-pulse" : order.status === "preparing" ? "bg-info" : "bg-muted"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold">{order.tableNo}</span>
                    {payChip(order.paymentMethod)}
                    <span className="text-xs text-muted-foreground">{order.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{order.customerName ? `${order.customerName} · ` : ""}{order.items.map(i => i.name).join(", ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-primary">₹{order.total}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${order.status === "new" ? "bg-warning-subtle text-warning" : order.status === "ready" ? "bg-success-subtle text-success" : order.status === "preparing" ? "bg-info-subtle text-info" : "bg-muted text-muted-foreground"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold mb-4">Top Selling Items</h3>
          <div className="space-y-3">
            {published && topItems.length > 0 ? topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.orders} orders · ₹{item.revenue.toLocaleString()}</p>
                </div>
                <span className={`text-xs font-semibold ${item.trend?.startsWith("-") ? "text-danger" : item.trend === "0%" ? "text-muted-foreground" : "text-success"}`}>{item.trend}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-6">{published ? "No item sales data yet" : "No data available yet"}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Section Occupancy</h3>
            <button onClick={() => navigate("/restaurant/tables")} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">View<ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="space-y-3">
            {sectionOccupancy.length === 0 ? <EmptyState title="No table sections loaded" /> : sectionOccupancy.map(sec => (
              <div key={sec.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{sec.name}</span>
                  <span className="text-muted-foreground">{sec.occupied}/{sec.total}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${sec.total ? (sec.occupied / sec.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Staff On Duty</h3>
            <button onClick={() => navigate("/restaurant/staff")} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">View<ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="space-y-2.5">
            {staffList.slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm">
                    {(() => { const RoleIcon = s.role === "chef" ? ChefHat : s.role === "waiter" ? UtensilsCrossed : s.role === "cashier" ? CreditCard : s.role === "manager" ? Building2 : User; return <RoleIcon className="h-4 w-4 text-muted-foreground" />; })()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${s.status === "active" ? "bg-success" : s.status === "on-break" ? "bg-warning" : "bg-muted"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.role} · {s.shift}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "active" ? "bg-success-subtle text-success" : s.status === "on-break" ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground"}`}>
                  {s.status === "on-break" ? "Break" : s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lowStockItems > 0 && (
        <div className="rounded-lg bg-danger-subtle border border-danger-border p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger">{lowStockItems} inventory items below minimum stock level</p>
              <p className="text-xs text-muted-foreground mt-0.5">Review inventory and reorder before service peaks</p>
            </div>
            <button onClick={() => navigate("/restaurant/inventory")} className="px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-sm font-semibold transition-colors shrink-0">
              View Inventory
            </button>
          </div>
        </div>
      )}

      {selOrder && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelOrder(null)}>
          <div className="w-full max-w-sm bg-card rounded-lg border border-border text-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Payment details</h3>
              <button onClick={() => setSelOrder(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-semibold text-primary">₹{Number(selOrder.total).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">{selOrder.tableNo} · {selOrder.id}</p>
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
                <div key={k as string} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right break-all capitalize">{v as string}</span>
                </div>
              ))}
              <button onClick={() => { navigate("/restaurant/orders"); }} className="w-full py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted">Open in Order Management</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
