import { Router, type IRouter } from "express";
import { eq, and, count, sum, gte, sql, desc } from "drizzle-orm";
import { db, menuItemsTable, ordersTable, qrCodesTable, customersTable, feedbackTable, reservationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyAnalyticsSummary,
  emptyOrderStats,
} from "../lib/restaurant-publication.js";

const router: IRouter = Router();

type Period = "today" | "week" | "month" | "year" | "all";

function periodStart(period: string): Date | null {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (period === "year") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  return null;
}

function parsePeriod(raw: unknown): Period {
  const p = String(raw || "all");
  if (p === "today" || p === "week" || p === "month" || p === "year") return p;
  return "all";
}

function countItemInOrders(orders: { items: unknown; createdAt: Date }[], itemName: string, since: Date, until?: Date) {
  let total = 0;
  const nameLower = itemName.toLowerCase();
  for (const o of orders) {
    const at = new Date(o.createdAt);
    if (at < since || (until && at >= until)) continue;
    const items = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : [];
    for (const it of items) {
      const n = String(it.name ?? it.itemName ?? "").toLowerCase();
      if (n === nameLower) total += parseInt(String(it.quantity ?? 1), 10) || 1;
    }
  }
  return total;
}

function formatGrowth(recent: number, previous: number): string {
  if (previous <= 0) return recent > 0 ? "+100%" : "0%";
  const pct = Math.round(((recent - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

router.get("/restaurants/:restaurantId/analytics/summary", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, restaurantId);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }

  const period = parsePeriod(req.query.period);
  const periodLabel = period === "today" ? "Today" : period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : period === "year" ? "Last 12 months" : "All time";

  if (access.kind === "unpublished") {
    res.json(emptyAnalyticsSummary(period, periodLabel));
    return;
  }

  const since = periodStart(period);
  const orderWhere = since
    ? and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, since))
    : eq(ordersTable.restaurantId, restaurantId);

  const [totalOrdersRow] = await db.select({ count: count() }).from(ordersTable).where(orderWhere);
  const periodOrders = await db.select({ total: ordersTable.total }).from(ordersTable).where(orderWhere);
  const totalRevenue = periodOrders.reduce((s, o) => s + parseFloat(o.total as string || "0"), 0);
  const avgOrderValue = totalOrdersRow?.count ? totalRevenue / totalOrdersRow.count : 0;

  const [totalCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
  const [totalScansRow] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable).where(eq(qrCodesTable.restaurantId, restaurantId));
  const [repeatCustomers] = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.restaurantId, restaurantId)));
  const feedbackRows = await db.select({ rating: feedbackTable.rating, foodRating: feedbackTable.foodRating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurantId));
  const [reservationsRow] = await db.select({ count: count() }).from(reservationsTable).where(eq(reservationsTable.restaurantId, restaurantId));
  const avgRating = feedbackRows.length ? feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length : 0;
  const avgFoodRating = feedbackRows.length
    ? feedbackRows.reduce((s, f) => s + (f.foodRating ?? f.rating), 0) / feedbackRows.length
    : 0;

  res.json({
    isPublished: true,
    period,
    periodLabel,
    totalOrders: totalOrdersRow?.count ?? 0,
    totalRevenue,
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    totalCustomers: totalCustomers?.count ?? 0,
    qrScans: parseInt(String(totalScansRow?.total ?? 0)),
    repeatCustomers: repeatCustomers?.count ?? 0,
    feedbackAvgRating: parseFloat(avgRating.toFixed(1)),
    avgFoodRating: parseFloat(avgFoodRating.toFixed(1)),
    topCategory: "",
    views: parseInt(String(totalScansRow?.total ?? 0)),
    ratings: parseFloat(avgRating.toFixed(1)),
    reviews: feedbackRows.length,
    reservations: reservationsRow?.count ?? 0,
    growth: 0,
  });
});

router.get("/restaurants/:restaurantId/analytics/popular-items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, restaurantId);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json([]); return; }

  const items = await db.select({
    id: menuItemsTable.id,
    name: menuItemsTable.name,
    imageUrl: menuItemsTable.imageUrl,
    orderCount: menuItemsTable.orderCount,
    price: menuItemsTable.price,
  })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.restaurantId, restaurantId))
    .orderBy(sql`${menuItemsTable.orderCount} DESC`)
    .limit(10);

  const allOrders = await db.select({ items: ordersTable.items, createdAt: ordersTable.createdAt })
    .from(ordersTable)
    .where(eq(ordersTable.restaurantId, restaurantId));

  const feedbackRows = await db.select({ foodRating: feedbackTable.foodRating, rating: feedbackTable.rating })
    .from(feedbackTable)
    .where(eq(feedbackTable.restaurantId, restaurantId));
  const restaurantFoodRating = feedbackRows.length
    ? feedbackRows.reduce((s, f) => s + (f.foodRating ?? f.rating), 0) / feedbackRows.length
    : 0;

  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 14);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 28);

  res.json(items.map(i => {
    const recent = countItemInOrders(allOrders, i.name, recentStart);
    const previous = countItemInOrders(allOrders, i.name, previousStart, recentStart);
    return {
      itemId: i.id,
      name: i.name,
      imageUrl: i.imageUrl,
      totalOrders: i.orderCount,
      totalRevenue: parseFloat(String(i.price)) * i.orderCount,
      avgRating: restaurantFoodRating > 0 ? parseFloat(restaurantFoodRating.toFixed(1)) : 0,
      growth: formatGrowth(recent, previous),
    };
  }));
});

router.get("/restaurants/:restaurantId/analytics/daily-sales", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, restaurantId);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json([]); return; }

  const period = parsePeriod(req.query.period);
  const since = periodStart(period) ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  })();

  const rows = await db.select({
    date: sql<string>`DATE(${ordersTable.createdAt})::text`,
    orders: count(),
    revenue: sum(ordersTable.total),
  }).from(ordersTable)
    .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, since)))
    .groupBy(sql`DATE(${ordersTable.createdAt})`).orderBy(sql`DATE(${ordersTable.createdAt})`);

  res.json(rows.map(r => ({ date: r.date, orders: r.orders, revenue: parseFloat(String(r.revenue ?? 0)) })));
});

router.get("/restaurants/:restaurantId/analytics/order-stats", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, restaurantId);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyOrderStats()); return; }

  const period = parsePeriod(req.query.period);
  const since = periodStart(period);

  const statuses = ["pending", "confirmed", "preparing", "ready", "delivered", "completed", "cancelled"];
  const types = ["dine_in", "delivery", "takeaway"];
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const s of statuses) {
    const where = since
      ? and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.status, s), gte(ordersTable.createdAt, since))
      : and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.status, s));
    const [r] = await db.select({ count: count() }).from(ordersTable).where(where);
    byStatus[s] = r?.count ?? 0;
  }
  for (const t of types) {
    const where = since
      ? and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.type, t), gte(ordersTable.createdAt, since))
      : and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.type, t));
    const [r] = await db.select({ count: count() }).from(ordersTable).where(where);
    byType[t] = r?.count ?? 0;
  }

  const orderWhere = since
    ? and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, since))
    : eq(ordersTable.restaurantId, restaurantId);
  const orders = await db.select({ paymentMethod: ordersTable.paymentMethod, total: ordersTable.total, createdAt: ordersTable.createdAt })
    .from(ordersTable).where(orderWhere);

  const paymentCounts: Record<string, number> = {};
  for (const o of orders) {
    const m = (o.paymentMethod || "cash").toLowerCase();
    const key = m.includes("upi") ? "UPI" : m.includes("card") ? "Card" : m.includes("wallet") ? "Wallet" : "Cash";
    paymentCounts[key] = (paymentCounts[key] ?? 0) + 1;
  }
  const paymentTotal = Object.values(paymentCounts).reduce((a, b) => a + b, 0) || 1;
  const paymentMix = Object.entries(paymentCounts).map(([name, value]) => ({
    name, value: Math.round((value / paymentTotal) * 100),
    color: name === "UPI" ? "#f59e0b" : name === "Card" ? "#3b82f6" : name === "Wallet" ? "#8b5cf6" : "#10b981",
  }));

  const customers = await db.select().from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
  const segments = [
    { segment: "New Guests", count: customers.filter(c => c.segment === "new").length, percent: 0, color: "text-blue-400", bg: "bg-blue-500/20" },
    { segment: "Returning", count: customers.filter(c => c.segment === "regular").length, percent: 0, color: "text-emerald-400", bg: "bg-emerald-500/20" },
    { segment: "Loyal (5+ visits)", count: customers.filter(c => (c.totalOrders ?? 0) >= 5).length, percent: 0, color: "text-amber-400", bg: "bg-amber-500/20" },
    { segment: "VIP Members", count: customers.filter(c => c.segment === "vip").length, percent: 0, color: "text-violet-400", bg: "bg-violet-500/20" },
  ];
  const segTotal = segments.reduce((s, x) => s + x.count, 0) || 1;
  for (const seg of segments) seg.percent = Math.round((seg.count / segTotal) * 100);

  const hourly: Record<string, number> = {};
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    const label = h === 0 ? "12AM" : h <= 12 ? `${h}${h === 12 ? "PM" : "AM"}` : `${h - 12}PM`;
    hourly[label] = (hourly[label] ?? 0) + 1;
  }
  res.json({
    isPublished: true,
    byStatus,
    byType,
    paymentMix,
    customerSegments: segments,
    hourlyOrders: Object.entries(hourly).map(([time, ordersCount]) => ({ time, orders: ordersCount })),
    growth: 0,
  });
});

router.get("/restaurants/:restaurantId/analytics/export", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, restaurantId);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }

  if (access.kind === "unpublished") {
    const lines = [
      "FastMenu Analytics Export",
      `Generated,${new Date().toISOString()}`,
      "",
      "Section,Metric,Value",
      "Summary,Total Orders,0",
      "",
      "Date,Orders,Revenue",
      "",
      "Top Items,,",
      "Item,Orders,Revenue",
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-${restaurantId}.csv"`);
    res.send(lines.join("\n"));
    return;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [orders, salesRows, items] = await Promise.all([
    db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId)),
    db.select({
      date: sql<string>`DATE(${ordersTable.createdAt})::text`,
      orders: count(),
      revenue: sum(ordersTable.total),
    }).from(ordersTable)
      .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${ordersTable.createdAt})`).orderBy(sql`DATE(${ordersTable.createdAt})`),
    db.select({ name: menuItemsTable.name, orderCount: menuItemsTable.orderCount, price: menuItemsTable.price })
      .from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId)).orderBy(sql`${menuItemsTable.orderCount} DESC`).limit(20),
  ]);
  const lines = [
    "FastMenu Analytics Export",
    `Generated,${new Date().toISOString()}`,
    "",
    "Section,Metric,Value",
    "Summary,Total Orders," + (orders[0]?.count ?? 0),
    "",
    "Date,Orders,Revenue",
    ...salesRows.map(r => `${r.date},${r.orders},${parseFloat(String(r.revenue ?? 0))}`),
    "",
    "Top Items,,",
    "Item,Orders,Revenue",
    ...items.map(i => `"${i.name}",${i.orderCount},${parseFloat(String(i.price)) * i.orderCount}`),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="analytics-${restaurantId}.csv"`);
  res.send(lines.join("\n"));
});

export default router;
