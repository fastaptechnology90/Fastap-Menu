import { Router, type IRouter } from "express";
import { eq, and, count, sum, desc, gte, lte } from "drizzle-orm";
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
import { isPaidOrder, orderGrossTotal } from "../lib/payment-calculations.js";
import { getSpaRevenue, getSpaRevenueBuckets } from "../lib/ancillary-revenue.js";

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

  // Staff sessions may only patch JSON settings, not core restaurant fields —
  // EXCEPT owners/managers/franchise, who may also edit the restaurant profile.
  if (req.session.staffSession && !req.session.userId) {
    const body = req.body as Record<string, any>;
    const { whiteLabelSettings, settings } = body;
    if (whiteLabelSettings) await setSettingsSection(id, "whiteLabel", whiteLabelSettings);
    if (settings && typeof settings === "object") {
      await setSettingsSection(id, "appSettings", settings);
    }
    const role = req.session.staffSession.staffRole;
    if (["owner", "manager", "franchise"].includes(role)) {
      // Persist the core profile columns that actually exist on the table. (Not via
      // UpdateRestaurantBody — that requires currency/primaryColor the profile form
      // doesn't send, so validation would fail and drop everything.)
      const core: Record<string, any> = {};
      for (const k of ["name", "address", "phone", "email", "description", "website"]) {
        if (body[k] !== undefined && body[k] !== null) core[k] = body[k];
      }
      if (Object.keys(core).length) {
        await db.update(restaurantsTable).set(core).where(eq(restaurantsTable.id, id));
      }
      // Extra profile fields that aren't restaurant columns → keep them in settings.
      const extras: Record<string, any> = {};
      for (const k of ["branch", "gstNumber", "fssaiNumber", "cuisineType", "totalTables", "totalSeats"]) {
        if (body[k] !== undefined) extras[k] = body[k];
      }
      if (Object.keys(extras).length) {
        const cur = await getSettingsSection(id, "profileExtras", {} as Record<string, unknown>);
        await setSettingsSection(id, "profileExtras", { ...cur, ...extras });
      }
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
  const fortnightStart = new Date(today); fortnightStart.setDate(fortnightStart.getDate() - 15);
  const monthStart = new Date(today); monthStart.setDate(1);

  const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id)).orderBy(desc(ordersTable.createdAt));
  const orderAt = (o: typeof allOrders[0]) => new Date(o.createdAt);
  // When a bill is COLLECTED we stamp metadata.payment.collectedAt. A bill collected today
  // must count toward today's revenue even if the order was opened on an earlier day — so a
  // period includes anything created OR collected within it.
  const collectedAt = (o: typeof allOrders[0]): Date | null => {
    const c = (o.metadata as any)?.payment?.collectedAt;
    if (!c) return null;
    const d = new Date(c);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const inPeriod = (o: typeof allOrders[0], since: Date) => {
    const col = collectedAt(o);
    return orderAt(o) >= since || (col != null && col >= since);
  };
  const todayOrders = allOrders.filter(o => inPeriod(o, today));
  const weekOrders = allOrders.filter(o => inPeriod(o, weekStart));
  const fortnightOrders = allOrders.filter(o => inPeriod(o, fortnightStart));
  const monthOrders = allOrders.filter(o => inPeriod(o, monthStart));
  // Revenue counts only PAID / in-flight orders (excludes cancelled/refunded/failed) — the
  // same rule the super-admin panel uses, so one restaurant shows one consistent number.
  const sumTotal = (list: typeof allOrders) => Math.round(list.filter(isPaidOrder).reduce((s, o) => s + orderGrossTotal(o), 0) * 100) / 100;

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

  // Fold spa revenue into the same buckets so the restaurant total includes it (one query).
  const [spaToday, spaWeek, spaFortnight, spaMonth] = await getSpaRevenueBuckets(id, [today, weekStart, fortnightStart, monthStart]);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  res.json({
    isPublished: true,
    publicationStatus: "Published",
    todayOrders: todayOrders.length,
    weekOrders: weekOrders.length,
    fortnightOrders: fortnightOrders.length,
    monthOrders: monthOrders.length,
    todayRevenue: r2(sumTotal(todayOrders) + spaToday),
    weekRevenue: r2(sumTotal(weekOrders) + spaWeek),
    fortnightRevenue: r2(sumTotal(fortnightOrders) + spaFortnight),
    monthRevenue: r2(sumTotal(monthOrders) + spaMonth),
    netRevenue: r2(sumTotal(monthOrders) + spaMonth),
    grossRevenue: r2(sumTotal(monthOrders) + spaMonth),
    spaRevenueMonth: spaMonth,
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

// Custom-date revenue for a restaurant panel — same PAID rule as everywhere else, so any
// panel (owner / cashier / finance / cash-counter) can show revenue for any day or range.
router.get("/restaurants/:restaurantId/revenue", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json({ from: null, to: null, revenue: 0, totalOrders: 0 }); return; }

  // Parse YYYY-MM-DD as a LOCAL midnight (not UTC) so day boundaries line up with the
  // server's clock and with collectedAt comparisons — avoids a timezone off-by-one.
  const parseDay = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parseDay(req.query.from);
  const toRaw = parseDay(req.query.to);
  const toEnd = toRaw ? new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999) : null;

  // Fetch all of the restaurant's orders and filter in JS so a bill COLLECTED in the range
  // counts even if the order was opened earlier (metadata.payment.collectedAt). This is what
  // makes "today's collection" reflect money actually taken today.
  const rows = await db.select({ total: ordersTable.total, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, createdAt: ordersTable.createdAt, metadata: ordersTable.metadata })
    .from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const inRange = (o: typeof rows[0]) => {
    const created = new Date(o.createdAt);
    const colRaw = (o.metadata as any)?.payment?.collectedAt;
    const collected = colRaw ? new Date(colRaw) : null;
    const okFrom = (d: Date | null) => d != null && (!from || d >= from) && (!toEnd || d <= toEnd);
    return okFrom(created) || (collected != null && !Number.isNaN(collected.getTime()) && okFrom(collected));
  };
  const paid = rows.filter(o => isPaidOrder(o) && inRange(o));
  const orderRevenue = Math.round(paid.reduce((s, o) => s + orderGrossTotal(o), 0) * 100) / 100;
  const spaRevenue = await getSpaRevenue(id, from, toEnd);   // spa folded into the total
  res.json({
    from: from ? from.toISOString().slice(0, 10) : null,
    to: toRaw ? toRaw.toISOString().slice(0, 10) : null,
    revenue: Math.round((orderRevenue + spaRevenue) * 100) / 100,
    orderRevenue,
    spaRevenue,
    totalOrders: paid.length,
  });
});

// Full revenue breakdown for the owner — how much came from which panel/source, which
// order type, and which payment method. Uses the SAME paid-order rule + spa fold as
// /revenue, so every section sums to the same grand total (no mismatch).
router.get("/restaurants/:restaurantId/revenue-breakdown", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json({ from: null, to: null, total: 0, orderRevenue: 0, spaRevenue: 0, totalOrders: 0, bySource: [], byType: [], byMethod: [] }); return; }

  const parseDay = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parseDay(req.query.from);
  const toRaw = parseDay(req.query.to);
  const toEnd = toRaw ? new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999) : null;

  const rows = await db.select({ total: ordersTable.total, subtotal: ordersTable.subtotal, tax: ordersTable.tax, tipAmount: ordersTable.tipAmount, paymentStatus: ordersTable.paymentStatus, status: ordersTable.status, type: ordersTable.type, paymentMethod: ordersTable.paymentMethod, createdAt: ordersTable.createdAt, metadata: ordersTable.metadata })
    .from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const inRange = (o: typeof rows[0]) => {
    const created = new Date(o.createdAt);
    const colRaw = (o.metadata as any)?.payment?.collectedAt;
    const collected = colRaw ? new Date(colRaw) : null;
    const okFrom = (d: Date | null) => d != null && (!from || d >= from) && (!toEnd || d <= toEnd);
    return okFrom(created) || (collected != null && !Number.isNaN(collected.getTime()) && okFrom(collected));
  };
  const paid = rows.filter(o => isPaidOrder(o) && inRange(o));

  const round = (n: number) => Math.round(n * 100) / 100;
  const orderRevenue = round(paid.reduce((s, o) => s + orderGrossTotal(o), 0));
  const spaRevenue = await getSpaRevenue(id, from, toEnd);

  // Which panel a given order type belongs to
  const sourceOf = (t: string | null | undefined): string => {
    const x = String(t || "").toLowerCase();
    if (x.includes("room")) return "Room Service";
    if (x.includes("bar")) return "Bar";
    if (x.includes("take") || x.includes("pickup")) return "Takeaway";
    if (x.includes("deliver")) return "Delivery";
    if (x.includes("banquet") || x.includes("event")) return "Events & Banquet";
    return "Restaurant / POS";
  };
  const methodOf = (o: typeof rows[0]): string => {
    const m = String((o.metadata as any)?.payment?.method || o.paymentMethod || "cash").toLowerCase();
    if (m.includes("upi")) return "UPI";
    if (m.includes("card")) return "Card";
    if (m.includes("cash")) return "Cash";
    if (m.includes("wallet")) return "Wallet";
    if (m.includes("room") || m.includes("bill")) return "Room bill";
    return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Other";
  };

  const accumulate = (keyFn: (o: typeof rows[0]) => string) => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const o of paid) {
      const k = keyFn(o);
      const cur = map.get(k) || { amount: 0, count: 0 };
      cur.amount += orderGrossTotal(o); cur.count += 1;
      map.set(k, cur);
    }
    return map;
  };

  const sourceMap = accumulate(o => sourceOf(o.type));
  const typeMap = accumulate(o => String(o.type || "dine_in"));
  const methodMap = accumulate(o => methodOf(o));

  const bySource = [...sourceMap.entries()].map(([label, v]) => ({ label, amount: round(v.amount), count: v.count }));
  if (spaRevenue > 0) bySource.push({ label: "Spa", amount: round(spaRevenue), count: 0 });
  bySource.sort((a, b) => b.amount - a.amount);

  const byType = [...typeMap.entries()].map(([type, v]) => ({ type, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);
  const byMethod = [...methodMap.entries()].map(([method, v]) => ({ method, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);

  res.json({
    from: from ? from.toISOString().slice(0, 10) : null,
    to: toRaw ? toRaw.toISOString().slice(0, 10) : null,
    total: round(orderRevenue + spaRevenue),
    orderRevenue,
    spaRevenue,
    totalOrders: paid.length,
    bySource,
    byType,
    byMethod,
  });
});

export default router;
