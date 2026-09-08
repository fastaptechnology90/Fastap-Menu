import { Router, type IRouter } from "express";
import { eq, and, count, sum, gte, sql, desc } from "drizzle-orm";
import { db, menuItemsTable, categoriesTable, ordersTable, qrCodesTable, customersTable, feedbackTable, reservationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyAnalyticsSummary,
  emptyOrderStats,
} from "../lib/restaurant-publication.js";
import { isPaidOrder, orderGrossTotal } from "../lib/payment-calculations.js";

const router: IRouter = Router();

type Period = "today" | "week" | "fortnight" | "month" | "year" | "all";

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
  if (period === "fortnight") {
    const d = new Date(now);
    d.setDate(d.getDate() - 15);
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
  if (p === "today" || p === "week" || p === "fortnight" || p === "month" || p === "year") return p;
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
  const periodLabel = period === "today" ? "Today" : period === "week" ? "Last 7 days" : period === "fortnight" ? "Last 15 days" : period === "month" ? "Last 30 days" : period === "year" ? "Last 12 months" : "All time";

  if (access.kind === "unpublished") {
    res.json(emptyAnalyticsSummary(period, periodLabel));
    return;
  }

  const since = periodStart(period);
  const orderWhere = since
    ? and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, since))
    : eq(ordersTable.restaurantId, restaurantId);

  const [totalOrdersRow] = await db.select({ count: count() }).from(ordersTable).where(orderWhere);
  // Revenue = PAID / in-flight orders only (same rule as owner dashboard & super-admin).
  const periodOrders = await db.select({ total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status }).from(ordersTable).where(orderWhere);
  const paidOrders = periodOrders.filter(isPaidOrder);
  const totalRevenue = Math.round(paidOrders.reduce((s, o) => s + orderGrossTotal(o), 0) * 100) / 100;
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  const [totalCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
  const [totalScansRow] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable).where(eq(qrCodesTable.restaurantId, restaurantId));
  // A "repeat" customer is one who has come back. This ran the same query as the total,
  // so the two figures were always identical and the panel showed 100% repeat business.
  const [repeatCustomers] = await db.select({ count: count() }).from(customersTable)
    .where(and(eq(customersTable.restaurantId, restaurantId), gte(customersTable.totalOrders, 2)));
  const feedbackRows = await db.select({ rating: feedbackTable.rating, foodRating: feedbackTable.foodRating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurantId));
  const [reservationsRow] = await db.select({ count: count() }).from(reservationsTable).where(eq(reservationsTable.restaurantId, restaurantId));
  const avgRating = feedbackRows.length ? feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length : 0;
  const avgFoodRating = feedbackRows.length
    ? feedbackRows.reduce((s, f) => s + (f.foodRating ?? f.rating), 0) / feedbackRows.length
    : 0;

  // Top category and growth were shipped as an empty string and a literal 0. Both are
  // derivable: the category comes from the menu rows the period's paid orders name, and
  // growth compares this period's revenue with the preceding period of the same length.
  const categoryRows = await db.select({ name: menuItemsTable.name, category: categoriesTable.name })
    .from(menuItemsTable)
    .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
    .where(eq(menuItemsTable.restaurantId, restaurantId));
  const categoryOf = new Map(categoryRows.map(m => [m.name.toLowerCase(), m.category ?? ""]));
  const lineOrders = await db.select({ items: ordersTable.items, total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, createdAt: ordersTable.createdAt })
    .from(ordersTable).where(orderWhere);
  const categoryTotals = new Map<string, number>();
  for (const o of lineOrders) {
    if (!isPaidOrder(o)) continue;
    const lines = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : [];
    for (const line of lines) {
      const cat = categoryOf.get(String(line.name ?? line.itemName ?? "").toLowerCase()) || "";
      if (!cat) continue;
      const qty = parseInt(String(line.quantity ?? 1), 10) || 1;
      const price = parseFloat(String(line.price ?? 0)) || 0;
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + qty * price);
    }
  }
  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  let growth = 0;
  if (since) {
    const spanMs = Date.now() - since.getTime();
    const priorStart = new Date(since.getTime() - spanMs);
    const priorRows = await db.select({ total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, priorStart)));
    const priorRevenue = priorRows
      .filter(o => isPaidOrder(o) && new Date(o.createdAt) < since)
      .reduce((sum, o) => sum + orderGrossTotal(o), 0);
    if (priorRevenue > 0) growth = Math.round(((totalRevenue - priorRevenue) / priorRevenue) * 100);
    else if (totalRevenue > 0) growth = 100;
  }

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
    topCategory,
    views: parseInt(String(totalScansRow?.total ?? 0)),
    ratings: parseFloat(avgRating.toFixed(1)),
    reviews: feedbackRows.length,
    reservations: reservationsRow?.count ?? 0,
    growth,
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

  const allOrders = await db.select({
    id: ordersTable.id, items: ordersTable.items, createdAt: ordersTable.createdAt,
    paymentStatus: ordersTable.paymentStatus, status: ordersTable.status,
  })
    .from(ordersTable)
    .where(eq(ordersTable.restaurantId, restaurantId));

  // A dish's rating used to be the restaurant's overall food rating, printed identically
  // against every dish — so a dish nobody liked wore the venue's average. A rating only
  // belongs to a dish if a guest who ate it left one, which is what the order link on the
  // feedback row gives us. A dish with no such feedback reports no rating at all.
  const feedbackRows = await db.select({
    orderId: feedbackTable.orderId, foodRating: feedbackTable.foodRating, rating: feedbackTable.rating,
  })
    .from(feedbackTable)
    .where(eq(feedbackTable.restaurantId, restaurantId));

  const itemsInOrder = new Map<number, Set<string>>();
  for (const o of allOrders) {
    const lines = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : [];
    const names = new Set(lines.map(l => String(l.name ?? l.itemName ?? "").toLowerCase()).filter(Boolean));
    if (names.size) itemsInOrder.set(o.id, names);
  }
  const ratingsByItem = new Map<string, { sum: number; n: number }>();
  for (const f of feedbackRows) {
    if (f.orderId == null) continue;
    const names = itemsInOrder.get(f.orderId);
    if (!names) continue;
    const score = f.foodRating ?? f.rating;
    if (score == null) continue;
    for (const n of names) {
      const cur = ratingsByItem.get(n) ?? { sum: 0, n: 0 };
      cur.sum += score;
      cur.n += 1;
      ratingsByItem.set(n, cur);
    }
  }

  // Revenue per dish is what its lines actually billed on paid orders, not list price
  // multiplied by a lifetime order counter that no discount or price change ever touched.
  const revenueByItem = new Map<string, number>();
  const unitsByItem = new Map<string, number>();
  for (const o of allOrders) {
    if (!isPaidOrder(o)) continue;
    const lines = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : [];
    for (const line of lines) {
      const key = String(line.name ?? line.itemName ?? "").toLowerCase();
      if (!key) continue;
      const qty = parseInt(String(line.quantity ?? 1), 10) || 1;
      const lineTotal = line.subtotal != null
        ? parseFloat(String(line.subtotal)) || 0
        : (parseFloat(String(line.price ?? 0)) || 0) * qty;
      revenueByItem.set(key, (revenueByItem.get(key) ?? 0) + lineTotal);
      unitsByItem.set(key, (unitsByItem.get(key) ?? 0) + qty);
    }
  }

  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 14);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 28);

  res.json(items.map(i => {
    const recent = countItemInOrders(allOrders, i.name, recentStart);
    const previous = countItemInOrders(allOrders, i.name, previousStart, recentStart);
    const key = i.name.toLowerCase();
    const rated = ratingsByItem.get(key);
    return {
      itemId: i.id,
      name: i.name,
      totalOrders: i.orderCount,
      imageUrl: i.imageUrl,
      unitsSold: unitsByItem.get(key) ?? 0,
      totalRevenue: Math.round((revenueByItem.get(key) ?? 0) * 100) / 100,
      avgRating: rated && rated.n > 0 ? Math.round((rated.sum / rated.n) * 10) / 10 : null,
      ratingCount: rated?.n ?? 0,
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

  // Aggregate in JS so we can apply the same PAID-order filter as the summary/dashboard.
  const dayRows = await db.select({
    createdAt: ordersTable.createdAt, total: ordersTable.total,
    paymentStatus: ordersTable.paymentStatus, status: ordersTable.status,
  }).from(ordersTable)
    .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, since)));

  const byDate = new Map<string, { orders: number; revenue: number }>();
  for (const o of dayRows) {
    if (!isPaidOrder(o)) continue;
    const date = new Date(o.createdAt).toISOString().slice(0, 10);
    const cur = byDate.get(date) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += orderGrossTotal(o);
    byDate.set(date, cur);
  }
  const result = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, orders: v.orders, revenue: Math.round(v.revenue * 100) / 100 }));
  res.json(result);
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
