import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, or, sql } from "drizzle-orm";
import {
  db, restaurantsTable, categoriesTable, menuItemsTable, ordersTable,
  customersTable, guestUsersTable,
} from "@workspace/db";
import { getAiCatalog, runPersonalizationEngine, type MenuItemEnriched, type OrderHistoryItem } from "../lib/aiPersonalizationLogic.js";

const router: IRouter = Router();

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

async function enrichMenuItems(restaurantId: number): Promise<MenuItemEnriched[]> {
  const items = await db.select().from(menuItemsTable).where(
    and(eq(menuItemsTable.restaurantId, restaurantId), eq(menuItemsTable.isAvailable, true)),
  );
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));
  const catSlug = Object.fromEntries(cats.map(c => [c.id, c.slug ?? ""]));
  return items.map(i => ({
    id: i.id,
    name: i.name,
    price: parseFloat(String(i.discountedPrice ?? i.price)),
    categorySlug: catSlug[i.categoryId ?? 0] ?? "",
    dietaryTags: Array.isArray(i.dietaryTags) ? i.dietaryTags as string[] : [],
    isFeatured: i.isFeatured ?? false,
    orderCount: i.orderCount ?? 0,
    chefRecommended: i.chefRecommended ?? false,
    description: i.description ?? undefined,
  }));
}

async function loadOrderHistory(restaurantId: number, guest: typeof guestUsersTable.$inferSelect | null): Promise<OrderHistoryItem[]> {
  if (!guest?.phone && !guest?.email) return [];
  const conditions = [eq(ordersTable.restaurantId, restaurantId)];
  const phone = guest.phone;
  const email = guest.email;
  const rows = await db.select().from(ordersTable).where(
    and(
      eq(ordersTable.restaurantId, restaurantId),
      or(
        phone ? eq(ordersTable.customerPhone, phone) : sql`false`,
        email ? eq(ordersTable.customerEmail, email) : sql`false`,
      ),
    ),
  ).orderBy(desc(ordersTable.createdAt)).limit(30);

  const history: OrderHistoryItem[] = [];
  for (const o of rows) {
    const items = Array.isArray(o.items) ? o.items as { name?: string; menuItemId?: number; price?: number; subtotal?: number }[] : [];
    for (const it of items) {
      history.push({
        name: it.name ?? "Item",
        menuItemId: it.menuItemId,
        price: parseFloat(String(it.price ?? 0)),
        total: parseFloat(String(o.total)),
        createdAt: o.createdAt,
      });
    }
    if (items.length === 0) {
      history.push({ name: "Order", total: parseFloat(String(o.total)), createdAt: o.createdAt });
    }
  }
  return history;
}

async function loadFavorites(restaurantId: number, guest: typeof guestUsersTable.$inferSelect | null): Promise<string[]> {
  if (!guest) return [];
  const [customer] = guest.phone || guest.email
    ? await db.select().from(customersTable).where(and(
      eq(customersTable.restaurantId, restaurantId),
      or(
        guest.phone ? eq(customersTable.phone, guest.phone) : sql`false`,
        guest.email ? eq(customersTable.email, guest.email) : sql`false`,
      ),
    ))
    : [undefined];
  const fav = customer?.favoriteItems;
  if (!Array.isArray(fav)) return [];
  return fav.map((f: { name?: string }) => f.name ?? "").filter(Boolean);
}

router.get("/public/ai/catalog", (_req, res) => {
  res.json(getAiCatalog());
});

router.post("/public/ai/engine", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }

  const guest = await getGuestUser(req);
  const items = await enrichMenuItems(restaurantId);
  const orderHistory = await loadOrderHistory(restaurantId, guest);
  const favorites = req.body.favorites ?? await loadFavorites(restaurantId, guest);

  const result = runPersonalizationEngine(items, {
    favorites: Array.isArray(favorites) ? favorites.map(String) : [],
    orderHistory,
    dietaryFilter: String(req.body.dietaryFilter ?? "all"),
    cartCourses: Array.isArray(req.body.cartCourses) ? req.body.cartCourses : [],
    cartItemIds: Array.isArray(req.body.cartItemIds) ? req.body.cartItemIds.map(Number) : [],
    cartItemNames: Array.isArray(req.body.cartItemNames) ? req.body.cartItemNames : [],
  });

  res.json({ ...result, live: true });
});

router.get("/public/ai/personalized-menu/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const guest = await getGuestUser(req);
  const items = await enrichMenuItems(restaurantId);
  const dietaryFilter = String(req.query.dietaryFilter ?? "all");
  const favorites = await loadFavorites(restaurantId, guest);
  const orderHistory = await loadOrderHistory(restaurantId, guest);
  const personalizedMenu = runPersonalizationEngine(items, { favorites, orderHistory, dietaryFilter }).personalizedMenu;
  res.json({ personalizedMenu, dietaryFilter });
});

router.get("/public/ai/favorite-predictions/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const guest = await getGuestUser(req);
  const items = await enrichMenuItems(restaurantId);
  const favorites = await loadFavorites(restaurantId, guest);
  const orderHistory = await loadOrderHistory(restaurantId, guest);
  const predictions = runPersonalizationEngine(items, { favorites, orderHistory }).favoritePredictions;
  res.json({ predictions });
});

router.post("/public/ai/combo-recommendations", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const items = await enrichMenuItems(restaurantId);
  const combos = runPersonalizationEngine(items, { cartItemNames: req.body.cartItemNames ?? [] }).comboRecommendations;
  res.json({ combos });
});

router.post("/public/ai/upsell", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const items = await enrichMenuItems(restaurantId);
  const upsells = runPersonalizationEngine(items, {
    cartCourses: req.body.cartCourses ?? [],
    cartItemIds: req.body.cartItemIds ?? [],
  }).upsells;
  res.json({ suggestions: upsells });
});

router.post("/public/ai/dietary-suggestions", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const items = await enrichMenuItems(restaurantId);
  const dietary = runPersonalizationEngine(items, { dietaryFilter: req.body.dietaryFilter ?? "all" }).dietarySuggestions;
  res.json(dietary);
});

router.get("/public/ai/spending-analysis/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const guest = await getGuestUser(req);
  const orderHistory = await loadOrderHistory(restaurantId, guest);
  const analysis = runPersonalizationEngine([], { orderHistory }).spendingAnalysis;
  res.json(analysis);
});

export default router;
