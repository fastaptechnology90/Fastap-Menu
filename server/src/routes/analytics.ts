import { Router, type IRouter } from "express";
import { eq, and, count, sum, gte, sql, desc } from "drizzle-orm";
import { db, menuItemsTable, ordersTable, qrCodesTable, menuViewsTable, customersTable, feedbackTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/analytics/summary", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [totalOrdersRow] = await db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId));
  const allOrders = await db.select({ total: ordersTable.total }).from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId));
  const totalRevenue = allOrders.reduce((s, o) => s + parseFloat(o.total as string || "0"), 0);
  const avgOrderValue = totalOrdersRow?.count ? totalRevenue / totalOrdersRow.count : 0;
  const [totalCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
  const [totalScansRow] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable).where(eq(qrCodesTable.restaurantId, restaurantId));
  const [repeatCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
  const feedbackRows = await db.select({ rating: feedbackTable.rating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurantId));
  const avgRating = feedbackRows.length ? feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length : 0;
  res.json({
    totalOrders: totalOrdersRow?.count ?? 0,
    totalRevenue,
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    totalCustomers: totalCustomers?.count ?? 0,
    qrScans: parseInt(String(totalScansRow?.total ?? 0)),
    repeatCustomers: repeatCustomers?.count ?? 0,
    feedbackAvgRating: parseFloat(avgRating.toFixed(1)),
    topCategory: "",
  });
});

router.get("/restaurants/:restaurantId/analytics/popular-items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const items = await db.select({ id: menuItemsTable.id, name: menuItemsTable.name, imageUrl: menuItemsTable.imageUrl, orderCount: menuItemsTable.orderCount, price: menuItemsTable.price })
    .from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId)).orderBy(sql`${menuItemsTable.orderCount} DESC`).limit(10);
  res.json(items.map(i => ({ itemId: i.id, name: i.name, imageUrl: i.imageUrl, totalOrders: i.orderCount, totalRevenue: parseFloat(i.price) * i.orderCount })));
});

router.get("/restaurants/:restaurantId/analytics/daily-sales", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const rows = await db.select({
    date: sql<string>`DATE(${ordersTable.createdAt})::text`,
    orders: count(),
    revenue: sum(ordersTable.total),
  }).from(ordersTable)
    .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, thirtyDaysAgo)))
    .groupBy(sql`DATE(${ordersTable.createdAt})`).orderBy(sql`DATE(${ordersTable.createdAt})`);
  res.json(rows.map(r => ({ date: r.date, orders: r.orders, revenue: parseFloat(String(r.revenue ?? 0)) })));
});

router.get("/restaurants/:restaurantId/analytics/order-stats", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const statuses = ["pending", "confirmed", "preparing", "ready", "delivered", "completed", "cancelled"];
  const types = ["dine_in", "delivery", "takeaway"];
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const s of statuses) {
    const [r] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.status, s)));
    byStatus[s] = r?.count ?? 0;
  }
  for (const t of types) {
    const [r] = await db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.type, t)));
    byType[t] = r?.count ?? 0;
  }
  res.json({ byStatus, byType });
});

export default router;
