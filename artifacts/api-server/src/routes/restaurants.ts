import { Router, type IRouter } from "express";
import { eq, and, count, sum, desc, gte } from "drizzle-orm";
import { db, restaurantsTable, usersTable, ordersTable, customersTable, inventoryItemsTable, reservationsTable, waiterCallsTable, qrCodesTable, feedbackTable } from "@workspace/db";
import { CreateRestaurantBody, UpdateRestaurantBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { createRestaurantRateLimit } from "../middlewares/rate-limit.js";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings.js";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyDashboardStats,
  isRestaurantPublished,
  getPublicationStatus,
} from "../lib/restaurant-publication.js";

const router: IRouter = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db.select({ id: restaurantsTable.id }).from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    if (existing.length === 0) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

router.get("/restaurants", requireAuth, async (req, res): Promise<void> => {
  const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.userId, req.session.userId!));
  res.json(restaurants);
});

router.post("/restaurants", requireAuth, createRestaurantRateLimit, async (req, res): Promise<void> => {
  const parsed = CreateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const slug = await uniqueSlug(slugify(parsed.data.name));
  const [restaurant] = await db.insert(restaurantsTable).values({ ...parsed.data, userId: req.session.userId!, slug }).returning();
  res.status(201).json(restaurant);
});

router.get("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const whiteLabelSettings = await getSettingsSection(id, "whiteLabel", {});
  res.json({
    ...restaurant,
    whiteLabelSettings,
    isPublished: isRestaurantPublished(restaurant),
    publicationStatus: getPublicationStatus(restaurant),
  });
});

router.put("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  // Staff sessions may only patch JSON settings, not core restaurant fields
  if (req.session.staffSession && !req.session.userId) {
    const { whiteLabelSettings, settings } = req.body as Record<string, unknown>;
    if (whiteLabelSettings) await setSettingsSection(id, "whiteLabel", whiteLabelSettings);
    if (settings && typeof settings === "object") {
      await setSettingsSection(id, "appSettings", settings);
    }
    const updated = await getAccessibleRestaurant(req, id);
    const whiteLabel = await getSettingsSection(id, "whiteLabel", {});
    res.json({ ...updated, whiteLabelSettings: whiteLabel });
    return;
  }

  const parsed = UpdateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(restaurantsTable).set(parsed.data).where(eq(restaurantsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json(updated);
});

router.get("/restaurants/:restaurantId/settings/white-label", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const whiteLabelSettings = await getSettingsSection(id, "whiteLabel", {});
  res.json({
    restaurant_name: restaurant.name,
    logo_url: restaurant.logoUrl ?? "",
    custom_domain: restaurant.customDomain ?? "",
    ...whiteLabelSettings,
  });
});

router.get("/restaurants/:restaurantId/settings/app", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const appSettings = await getSettingsSection(id, "appSettings", {});
  res.json(appSettings);
});

router.put("/restaurants/:restaurantId/settings/app", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const current = await getSettingsSection(id, "appSettings", {});
  const merged = { ...(current as object), ...req.body };
  await setSettingsSection(id, "appSettings", merged);
  res.json(merged);
});

router.put("/restaurants/:restaurantId/settings/white-label", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const restaurant = await getAccessibleRestaurant(req, id);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  await setSettingsSection(id, "whiteLabel", req.body);
  res.json({ success: true, whiteLabelSettings: req.body });
});

router.delete("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(restaurantsTable).where(and(eq(restaurantsTable.id, id), eq(restaurantsTable.userId, req.session.userId!))).returning();
  if (!deleted) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json({ message: "Restaurant deleted" });
});

router.get("/restaurants/:restaurantId/dashboard", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") {
    res.json(emptyDashboardStats(access.status));
    return;
  }

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(today); monthStart.setDate(1);

  const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id)).orderBy(desc(ordersTable.createdAt));
  const orderAt = (o: typeof allOrders[0]) => new Date(o.createdAt);
  const todayOrders = allOrders.filter(o => orderAt(o) >= today);
  const weekOrders = allOrders.filter(o => orderAt(o) >= weekStart);
  const monthOrders = allOrders.filter(o => orderAt(o) >= monthStart);
  const sumTotal = (list: typeof allOrders) => list.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0);

  const activeOrders = allOrders.filter(o => ["pending", "confirmed", "preparing", "ready"].includes(o.status));
  const cancelledOrders = allOrders.filter(o => o.status === "cancelled");
  const byType = (type: string) => allOrders.filter(o => o.type === type).length;

  const customers = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, id));
  const vipCustomers = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.restaurantId, id), eq(customersTable.segment, "vip")));
  const loyaltyCustomers = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.restaurantId, id), gte(customersTable.loyaltyPoints, 500)));

  const inventory = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.restaurantId, id));
  const lowStockItems = inventory.filter(i => parseFloat(String(i.currentStock || 0)) <= parseFloat(String(i.minStock || 0))).length;

  const pendingReservations = await db.select({ count: count() }).from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, id), eq(reservationsTable.status, "confirmed")),
  );
  const activeWaiterCalls = await db.select({ count: count() }).from(waiterCallsTable).where(
    and(eq(waiterCallsTable.restaurantId, id), eq(waiterCallsTable.isResolved, false)),
  );
  const [totalScansRow] = await db.select({ total: sum(qrCodesTable.scans) }).from(qrCodesTable).where(eq(qrCodesTable.restaurantId, id));

  const feedbackRows = await db.select({ rating: feedbackTable.rating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, id));
  const avgRating = feedbackRows.length ? feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length : 0;

  const ONLINE_METHODS = new Set(["upi", "card", "netbanking", "wallet", "online", "razorpay", "gateway"]);
  let totalOnlineSales = 0;
  let refundAmount = 0;
  for (const o of allOrders) {
    if (o.paymentStatus === "refunded") refundAmount += parseFloat(String(o.total || 0));
    else if (o.paymentStatus === "paid" || o.status === "completed") {
      const method = (o.paymentMethod || "cash").toLowerCase();
      if (ONLINE_METHODS.has(method)) totalOnlineSales += parseFloat(String(o.total || 0));
    }
  }
  const commissionRate = 0.02;
  const onlineBalance = Math.round(totalOnlineSales * (1 - commissionRate) - refundAmount * 0.5);
  const pendingSettlement = Math.round(Math.max(0, onlineBalance * 0.15));

  res.json({
    isPublished: true,
    publicationStatus: "Published",
    todayOrders: todayOrders.length,
    todayRevenue: sumTotal(todayOrders),
    weekRevenue: sumTotal(weekOrders),
    monthRevenue: sumTotal(monthOrders),
    netRevenue: sumTotal(monthOrders),
    grossRevenue: sumTotal(monthOrders),
    activeOrders: activeOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalCustomers: customers[0]?.count ?? 0,
    vipCustomers: vipCustomers[0]?.count ?? 0,
    loyaltyCustomers: loyaltyCustomers[0]?.count ?? 0,
    avgOrderValue: todayOrders.length ? sumTotal(todayOrders) / todayOrders.length : 0,
    avgRating: parseFloat(avgRating.toFixed(1)),
    qrScansToday: parseInt(String(totalScansRow?.total ?? 0)),
    pendingReservations: pendingReservations[0]?.count ?? 0,
    lowStockItems,
    activeWaiterCalls: activeWaiterCalls[0]?.count ?? 0,
    walletBalance: onlineBalance,
    pendingSettlements: pendingSettlement,
    ordersByType: {
      dine_in: byType("dine_in"),
      takeaway: byType("takeaway"),
      delivery: byType("delivery"),
      room_service: byType("room_service"),
    },
    recentOrders: allOrders.slice(0, 10).map(o => ({
      ...o,
      items: Array.isArray(o.items) ? o.items : [],
    })),
  });
});

export default router;
