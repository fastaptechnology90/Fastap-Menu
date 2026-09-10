import { useLocation } from "wouter";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { analytics as analyticsApi, restaurantApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { RevenueByDate } from "@/components/restaurant/RevenueByDate";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import {
  TrendingUp, Users, Grid3x3, AlertTriangle, Star, Clock, ArrowRight,
  ChefHat, UtensilsCrossed, CreditCard, Building2, User, Bell, Package,
  CalendarClock, Wallet, X, Receipt,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ────────────────────────────────────────────────────────────────────────────
   Restaurant dashboard

   The question this screen answers is "what is happening right now" — and the
   old one answered it with eight identical tiles, five of which were usually
   zero, laid out eight-across so that at 1280px each was 140px wide. A number
   that matters and a number that does not cannot be the same size.

   So: three figures at the top, big, because those are the three a manager
   actually reads mid-service — orders in flight, the floor, today's takings.
   Then only the alerts that are actually raised. Then the two working lists,
   then the day's money, then the house. Nothing on this page is a tile whose
   only job is to say zero.
   ──────────────────────────────────────────────────────────────────────────── */

// The owner reads these as their books, not as a headline. "₹47.9K" hides up to
// ₹99 of takings and cannot be reconciled against anything, so print the rupee figure.
function formatRevenue(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Small payment-method chip so the live order rows show how each order was paid.
const PAY_CHIP: Record<string, string> = {
  upi: "UPI", cash: "Cash", card: "Card",
  room_bill: "Room", aggregator: "Aggregator", wallet: "Wallet",
};
function payChip(mode?: string) {
  // Same as the order list: an order with no method has not been paid yet.
  if (!mode) return <Badge variant="warning" className="text-2xs">Unpaid</Badge>;
  const m = mode.toLowerCase();
  const label = PAY_CHIP[m]
    || ((m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway" : mode);
  return <Badge variant="muted" className="text-2xs">{label}</Badge>;
}

/* Written out in full — Tailwind scans source text, so an interpolated class
   name is never emitted and the element ships invisible. */
const ORDER_TONE: Record<string, { dot: string; pill: string }> = {
  new:       { dot: "bg-warning", pill: "bg-warning-subtle text-warning" },
  accepted:  { dot: "bg-info",    pill: "bg-info-subtle text-info" },
  preparing: { dot: "bg-info",    pill: "bg-info-subtle text-info" },
  ready:     { dot: "bg-success", pill: "bg-success-subtle text-success" },
  served:    { dot: "bg-success", pill: "bg-success-subtle text-success" },
};
const ORDER_TONE_DEFAULT = { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground" };

const card = "rounded-md border border-border bg-card";
const cardPad = "p-4 sm:p-5";
const sectionHead = "mb-3 flex items-center justify-between gap-2";
const sectionTitle = "text-sm font-semibold";
const linkBtn = "inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-colors hover-elevate";

function roleIconFor(role: string) {
  return role === "chef" ? ChefHat
    : role === "waiter" ? UtensilsCrossed
    : role === "cashier" ? CreditCard
    : role === "manager" ? Building2
    : User;
}

export default function RestaurantDashboard() {
  const [, navigate] = useLocation();
  const { liveOrders, tables, restaurant, currentStaff, staffList, menuItems, restaurantId, isRestaurantPublished } = useRestaurant();
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
  const monthRevenue = published ? (dashboard?.monthRevenue ?? 0) : 0;
  const monthOrderCount = published ? (dashboard?.monthOrders ?? 0) : 0;
  const todayOrders = published ? (dashboard?.todayOrders ?? 0) : 0;
  const avgOrderValue = published ? (dashboard?.avgOrderValue ?? 0) : 0;
  const activeOrders = published ? (dashboard?.activeOrders ?? 0) : 0;
  const newOrders = published ? liveOrders.filter(o => o.status === "new").length : 0;
  const readyOrders = published ? liveOrders.filter(o => o.status === "ready").length : 0;
  const lowStockItems = dashboard?.lowStockItems ?? 0;
  const avgRating = published ? (dashboard?.avgRating ?? 0) : 0;
  const walletBalance = published ? (dashboard?.walletBalance ?? 0) : 0;
  const pendingSettlements = published ? (dashboard?.pendingSettlements ?? 0) : 0;
  const vipCustomers = published ? (dashboard?.vipCustomers ?? 0) : 0;
  const loyaltyCustomers = published ? (dashboard?.loyaltyCustomers ?? 0) : 0;
  const activeWaiterCalls = published ? (dashboard?.activeWaiterCalls ?? 0) : 0;
  const pendingReservations = published ? (dashboard?.pendingReservations ?? 0) : 0;

  const occupiedTables = tables.filter(t => t.status === "occupied" || t.status === "billing").length;
  const reservedTables = tables.filter(t => t.status === "reserved").length;
  const totalTables = restaurant.totalTables || tables.length;
  const occupancyPct = totalTables ? Math.round((occupiedTables / totalTables) * 100) : 0;

  const sectionOccupancy = useMemo(() => {
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
  }, [tables]);

  /** In-flight orders, newest first, so the list is the thing that moves rather
   *  than a static top-five. */
  const inFlight = useMemo(
    () => (published ? liveOrders.filter(o => !["billed", "cancelled"].includes(o.status)) : []),
    [liveOrders, published],
  );

  /** Only what is actually raised. An alert row that reads "0" trains people to
   *  stop looking at the alert row. */
  const alerts = [
    activeWaiterCalls > 0 && {
      key: "calls", icon: Bell, to: "/restaurant/waiter",
      text: `${activeWaiterCalls} table${activeWaiterCalls > 1 ? "s" : ""} calling a waiter`,
      tone: "border-warning-border bg-warning-subtle text-warning",
    },
    lowStockItems > 0 && {
      key: "stock", icon: Package, to: "/restaurant/inventory",
      text: `${lowStockItems} item${lowStockItems > 1 ? "s" : ""} below minimum stock`,
      tone: "border-danger-border bg-danger-subtle text-danger",
    },
    pendingReservations > 0 && {
      key: "resv", icon: CalendarClock, to: "/restaurant/reservations",
      text: `${pendingReservations} reservation${pendingReservations > 1 ? "s" : ""} still to confirm`,
      tone: "border-info-border bg-info-subtle text-info",
    },
  ].filter(Boolean) as { key: string; icon: typeof Bell; to: string; text: string; tone: string }[];

  /* The three figures a manager reads mid-service. Nothing else gets this size. */
  const nowTiles = [
    {
      key: "orders",
      label: "Orders in flight",
      value: String(activeOrders),
      sub: `${newOrders} new · ${readyOrders} ready to run`,
      icon: Clock,
      to: "/restaurant/orders",
      accent: newOrders > 0 ? "text-warning" : "text-foreground",
    },
    {
      key: "floor",
      label: "The floor",
      value: `${occupiedTables}/${totalTables}`,
      sub: `${occupancyPct}% occupied${reservedTables > 0 ? ` · ${reservedTables} reserved` : ""}`,
      icon: Grid3x3,
      to: "/restaurant/tables",
      accent: "text-foreground",
    },
    {
      key: "takings",
      label: "Today's takings",
      value: formatRevenue(todayRevenue),
      sub: `${todayOrders} bills · avg ${formatRevenue(avgOrderValue)}`,
      icon: TrendingUp,
      to: "/restaurant/day-end",
      accent: "text-foreground",
    },
  ];

  /* Real, but not urgent. Small, in one strip, under the chart. */
  const dayFigures = [
    { key: "month", label: "This month", value: formatRevenue(monthRevenue), sub: `${monthOrderCount} orders` },
    { key: "week", label: "This week", value: formatRevenue(weekRevenue), sub: "rolling 7 days" },
    { key: "wallet", label: "Wallet", value: formatRevenue(walletBalance), sub: `${formatRevenue(pendingSettlements)} to settle`, icon: Wallet },
    { key: "rating", label: "Rating", value: String(avgRating || "—"), sub: `${vipCustomers} VIP · ${loyaltyCustomers} loyalty`, icon: Star },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* ── Who, where, when, and is this live ───────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {greetingFor(new Date().getHours())}{currentStaff?.name ? `, ${currentStaff.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {restaurant.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
          {lastRefresh && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium ${
              published ? "border-success-border bg-success-subtle text-success" : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span className={`h-2 w-2 rounded-pill ${published ? "bg-success motion-safe:animate-pulse" : "bg-muted-foreground"}`} aria-hidden />
            {published ? "Live · every 15s" : "Not published"}
          </span>
        </div>
      </header>

      {!published && (
        <div className={`${card} ${cardPad}`} role="status">
          <p className="text-sm font-semibold">This venue is not published yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* First-run next steps — only when floor, rota or menu is empty, so a busy service
          night never sees onboarding chrome. */}
      {published && (tables.length === 0 || staffList.length === 0 || menuItems.length === 0) && (
        <div className={`${card} ${cardPad}`} role="status">
          <p className="text-sm font-semibold">Finish setup before service</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {tables.length === 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <span>Add tables so guests can scan and waiters can take orders.</span>
                <button type="button" onClick={() => navigate("/restaurant/tables")} className={linkBtn}>
                  Tables <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )}
            {menuItems.length === 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <span>Add dishes — guests and waiters cannot order without a menu.</span>
                <button type="button" onClick={() => navigate("/restaurant/menu")} className={linkBtn}>
                  Menu <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )}
            {staffList.length === 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <span>Add kitchen / waiter staff codes for the apps.</span>
                <button type="button" onClick={() => navigate("/restaurant/staff")} className={linkBtn}>
                  Staff <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )}
            {menuItems.length > 0 && (
              <li className="flex flex-wrap items-center gap-2">
                <span>Confirm dishes are live on Menu Management.</span>
                <button type="button" onClick={() => navigate("/restaurant/menu")} className={linkBtn}>
                  Menu <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── Right now ───────────────────────────────────────────────────────
          Three figures, one row from 640px, each one a link to the screen it
          summarises — reading a number and then hunting the nav for the screen
          behind it is the loop this closes. */}
      <section aria-label="Right now">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {nowTiles.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(t.to)}
              className={`${card} flex min-w-0 flex-col items-start p-4 text-left transition-colors hover-elevate active-elevate-2 sm:p-5`}
            >
              <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <t.icon className="h-4 w-4 shrink-0" aria-hidden />
                {t.label}
              </span>
              <span className={`mt-2 text-3xl font-semibold tabular-nums leading-none ${t.accent}`}>{t.value}</span>
              <span className="mt-2 text-xs text-muted-foreground">{t.sub}</span>
            </button>
          ))}
        </div>

        {alerts.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {alerts.map(a => (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => navigate(a.to)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-xs font-medium transition-colors hover-elevate active-elevate-2 ${a.tone}`}
                >
                  <a.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── The two working lists ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Orders in flight — the widest thing on the page, because it is the
            list that changes every minute of service. */}
        <section className={`${card} ${cardPad} lg:col-span-2`} aria-label="Orders in flight">
          <div className={sectionHead}>
            <div className="min-w-0">
              <h2 className={sectionTitle}>Orders in flight</h2>
              <p className="text-xs text-muted-foreground">
                {published ? `${inFlight.length} open · tap one for how it was paid` : "Orders appear once the venue is published"}
              </p>
            </div>
            <button type="button" onClick={() => navigate("/restaurant/orders")} className={linkBtn}>
              All orders <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>

          {inFlight.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {published
                ? "Nothing in flight. Guests order from the QR menu; waiters use Take order on the app."
                : "No data available yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {inFlight.slice(0, 6).map(order => {
                const tone = ORDER_TONE[order.status] ?? ORDER_TONE_DEFAULT;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => setSelOrder(order)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover-elevate active-elevate-2"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-pill ${tone.dot}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{order.tableNo}</span>
                          {payChip(order.paymentMethod)}
                          <span className="text-2xs text-muted-foreground">#{order.id}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {order.customerName ? `${order.customerName} · ` : ""}
                          {order.items.map(i => i.name).join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">{formatRevenue(order.total)}</span>
                        <span className={`mt-0.5 inline-block rounded-pill px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${tone.pill}`}>
                          {order.status}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* The floor, as a bar per section — the shape of the room rather than a
            single occupancy percentage that hides a full terrace and an empty hall. */}
        <section className={`${card} ${cardPad}`} aria-label="The floor">
          <div className={sectionHead}>
            <div className="min-w-0">
              <h2 className={sectionTitle}>The floor</h2>
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{occupiedTables}</span> of <span className="tabular-nums">{totalTables}</span> seated
              </p>
            </div>
            <button type="button" onClick={() => navigate("/restaurant/tables")} className={linkBtn}>
              Floor map <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>

          {sectionOccupancy.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No tables on the floor plan yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {sectionOccupancy.map(sec => (
                <li key={sec.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">{sec.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{sec.occupied}/{sec.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-muted">
                    <div
                      className="h-full rounded-pill bg-primary"
                      style={{ width: `${sec.total ? (sec.occupied / sec.total) * 100 : 0}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── The day's money ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`${card} ${cardPad} lg:col-span-2`} aria-label="Revenue trend">
          <div className={sectionHead}>
            <div className="min-w-0">
              <h2 className={sectionTitle}>Revenue trend</h2>
              <p className="text-xs text-muted-foreground">Last 12 days of takings</p>
            </div>
            <button type="button" onClick={() => navigate("/restaurant/revenue")} className={linkBtn}>
              Breakdown <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>

          {published && revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [formatRevenue(Number(v)), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              {published ? "No sales recorded yet" : "No data available yet"}
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {dayFigures.map(f => (
              <div key={f.key} className="min-w-0 bg-card p-3">
                <dt className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                  {f.icon ? <f.icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
                  {f.label}
                </dt>
                <dd className="mt-1 truncate text-base font-semibold tabular-nums">{f.value}</dd>
                <dd className="mt-0.5 truncate text-2xs text-muted-foreground">{f.sub}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${card} ${cardPad}`} aria-label="Top sellers">
          <div className={sectionHead}>
            <h2 className={sectionTitle}>Top sellers</h2>
            <button type="button" onClick={() => navigate("/restaurant/analytics")} className={linkBtn}>
              Analytics <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
          {published && topItems.length > 0 ? (
            <ol className="space-y-2.5">
              {topItems.slice(0, 6).map((item, i) => (
                <li key={item.name} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="tabular-nums">{item.orders}</span> orders · <span className="tabular-nums">{formatRevenue(item.revenue)}</span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold tabular-nums ${
                      item.trend?.startsWith("-") ? "text-danger" : item.trend === "0%" ? "text-muted-foreground" : "text-success"
                    }`}
                  >
                    {item.trend}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {published ? "No item sales recorded yet" : "No data available yet"}
            </p>
          )}
        </section>
      </div>

      {/* Custom-date takings, for any period the tiles above do not cover. */}
      <RevenueByDate restaurantId={restaurantId} title="Takings by date" />

      {/* ── The house ───────────────────────────────────────────────────── */}
      <section className={`${card} ${cardPad}`} aria-label="Staff on duty">
        <div className={sectionHead}>
          <div className="min-w-0">
            <h2 className={sectionTitle}>On duty</h2>
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums">{staffList.filter(s => s.status === "active").length}</span> working ·{" "}
              <span className="tabular-nums">{staffList.filter(s => s.status === "on-break").length}</span> on break
            </p>
          </div>
          <button type="button" onClick={() => navigate("/restaurant/staff")} className={linkBtn}>
            Staff <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {staffList.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No staff on the rota yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {staffList.slice(0, 9).map(s => {
              const RoleIcon = roleIconFor(s.role);
              return (
                <li key={s.id} className="flex min-w-0 items-center gap-2.5 rounded-md border border-border p-2.5">
                  <span className="relative shrink-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-muted text-muted-foreground">
                      <RoleIcon className="h-4 w-4" aria-hidden />
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-pill border-2 border-card ${
                        s.status === "active" ? "bg-success" : s.status === "on-break" ? "bg-warning" : "bg-muted-foreground"
                      }`}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{s.role} · {s.shift}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-2xs font-semibold capitalize ${
                      s.status === "active" ? "bg-success-subtle text-success"
                        : s.status === "on-break" ? "bg-warning-subtle text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status === "on-break" ? "Break" : s.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── One order: how it was paid ──────────────────────────────────── */}
      {selOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
          onClick={() => setSelOrder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment details"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-md border border-border bg-card sm:max-h-[calc(100dvh-2rem)] sm:max-w-sm sm:rounded-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-primary" aria-hidden /> Payment details
              </h2>
              <button
                type="button"
                onClick={() => setSelOrder(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover-elevate"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums">{formatRevenue(selOrder.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selOrder.tableNo} · #{selOrder.id}</p>
              </div>
              <dl className="divide-y divide-border rounded-md border border-border">
                {([
                  ["Payment method", String(selOrder.paymentMethod || "—").toUpperCase()],
                  ["Pay status", selOrder.paymentStatus || "—"],
                  ["UPI ID", selOrder.upiId || "—"],
                  ["UTR / reference", selOrder.utr || "—"],
                  ["Collected by", selOrder.collectedBy || "—"],
                  ["From panel", selOrder.collectedFrom || "—"],
                  ["Customer", selOrder.customerName || "—"],
                  ["Room", selOrder.roomNumber || "—"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-all text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <button
                type="button"
                onClick={() => navigate("/restaurant/orders")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-primary-border bg-primary text-sm font-semibold text-primary-foreground hover-elevate active-elevate-2"
              >
                Open in Orders <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
