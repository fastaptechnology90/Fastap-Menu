import { Router, type IRouter } from "express";
import { eq, and, count, desc } from "drizzle-orm";
import { db, restaurantsTable, usersTable, ordersTable, customersTable } from "../db/index.js";
import { CreateRestaurantBody, UpdateRestaurantBody } from "../schemas.js";
import { requireAuth } from "../middlewares/auth.js";

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

router.post("/restaurants", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const slug = await uniqueSlug(slugify(parsed.data.name));
  const [restaurant] = await db.insert(restaurantsTable).values({ ...parsed.data, userId: req.session.userId!, slug }).returning();
  res.status(201).json(restaurant);
});

router.get("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const user = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  const isSuperAdmin = user[0]?.role === "super_admin";
  let restaurant;
  if (isSuperAdmin) {
    [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
  } else {
    [restaurant] = await db.select().from(restaurantsTable).where(and(eq(restaurantsTable.id, id), eq(restaurantsTable.userId, req.session.userId!)));
  }
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json(restaurant);
});

router.put("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const parsed = UpdateRestaurantBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [restaurant] = await db.update(restaurantsTable).set(parsed.data).where(and(eq(restaurantsTable.id, id), eq(restaurantsTable.userId, req.session.userId!))).returning();
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json(restaurant);
});

router.delete("/restaurants/:restaurantId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(restaurantsTable).where(and(eq(restaurantsTable.id, id), eq(restaurantsTable.userId, req.session.userId!))).returning();
  if (!deleted) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json({ message: "Restaurant deleted" });
});

router.get("/restaurants/:restaurantId/dashboard", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id)).orderBy(desc(ordersTable.createdAt));
  const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= today);
  const activeOrders = allOrders.filter(o => ["pending", "confirmed", "preparing", "ready"].includes(o.status));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total as string), 0);
  const customers = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.restaurantId, id));
  res.json({
    todayOrders: todayOrders.length,
    todayRevenue,
    activeOrders: activeOrders.length,
    totalCustomers: customers[0]?.count ?? 0,
    qrScansToday: Math.floor(Math.random() * 50) + 10,
    pendingReservations: 0,
    lowStockItems: 0,
    recentOrders: allOrders.slice(0, 10).map(o => ({ ...o, items: Array.isArray(o.items) ? o.items : [] })),
    activeWaiterCalls: 0,
  });
});

export default router;
