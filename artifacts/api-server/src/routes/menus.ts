import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, categoriesTable, menuItemsTable, restaurantsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * A price has to be a real, non-negative amount.
 *
 * Nothing checked this. `price` went straight to `String(price)`, so a menu item could be
 * saved at -50 — and because the ordering route (rightly) prices every line from the menu
 * rather than from the client, that negative line then reduced the guest's bill. An order
 * placed against one came out with a negative subtotal and a total of zero: free food, and
 * a row whose own figures no longer add up.
 *
 * Returns null when the value is acceptable, or the message to refuse with.
 */
function priceProblem(value: unknown, label: string): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  if (n > 10_000_000) return `${label} is too large.`;
  return null;
}

async function ownsRestaurant(userId: number, restaurantId: number): Promise<boolean> {
  const [r] = await db.select({ id: restaurantsTable.id }).from(restaurantsTable)
    .where(and(eq(restaurantsTable.id, restaurantId), eq(restaurantsTable.userId, userId)));
  return !!r;
}

function parseItem(i: any) {
  return {
    ...i,
    price: parseFloat(i.price),
    discountedPrice: i.discountedPrice ? parseFloat(i.discountedPrice) : null,
    variants: Array.isArray(i.variants) ? i.variants : [],
    addons: Array.isArray(i.addons) ? i.addons : [],
    dietaryTags: Array.isArray(i.dietaryTags) ? i.dietaryTags : [],
  };
}

// Categories
router.get("/restaurants/:restaurantId/categories", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));
  res.json(cats);
});

router.post("/restaurants/:restaurantId/categories", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo } = req.body;
  const [cat] = await db.insert(categoriesTable).values({ restaurantId, name, imageUrl, sortOrder: sortOrder ?? 0, isAvailable: isAvailable ?? true, availableFrom, availableTo }).returning();
  res.status(201).json(cat);
});

router.put("/restaurants/:restaurantId/categories/:categoryId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const categoryId = parseInt(String(req.params.categoryId), 10);
  const { name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo } = req.body;
  const [cat] = await db.update(categoriesTable).set({ name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo }).where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.restaurantId, restaurantId))).returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(cat);
});

router.delete("/restaurants/:restaurantId/categories/:categoryId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const categoryId = parseInt(String(req.params.categoryId), 10);
  const [deleted] = await db.delete(categoriesTable).where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ message: "Category deleted" });
});

// Items
router.get("/restaurants/:restaurantId/items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined;
  let items;
  if (categoryId) {
    items = await db.select().from(menuItemsTable).where(and(eq(menuItemsTable.restaurantId, restaurantId), eq(menuItemsTable.categoryId, categoryId)));
  } else {
    items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
  }
  res.json(items.map(parseItem));
});

router.get("/restaurants/:restaurantId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const itemId = parseInt(String(req.params.itemId), 10);
  const [item] = await db.select().from(menuItemsTable).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId)));
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(parseItem(item));
});

router.post("/restaurants/:restaurantId/items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { name, description, price, discountedPrice, imageUrl, videoUrl, ingredients, allergens, calories, prepTime, spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons, categoryId } = req.body;
  if (typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "An item needs a name." }); return; }
  const badPrice = priceProblem(price, "Price")
    ?? (discountedPrice != null ? priceProblem(discountedPrice, "Offer price") : null);
  if (badPrice) { res.status(400).json({ error: badPrice }); return; }
  const [item] = await db.insert(menuItemsTable).values({
    restaurantId, categoryId, name, description, imageUrl, videoUrl, ingredients, allergens, calories, prepTime,
    price: String(price), discountedPrice: discountedPrice != null ? String(discountedPrice) : null,
    spiceLevel: spiceLevel ?? 0, dietaryTags: dietaryTags ?? [], isAvailable: isAvailable ?? true,
    isFeatured: isFeatured ?? false, sortOrder: sortOrder ?? 0, variants: variants ?? [], addons: addons ?? [],
  }).returning();
  res.status(201).json(parseItem(item));
});

router.put("/restaurants/:restaurantId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const itemId = parseInt(String(req.params.itemId), 10);
  const { name, description, price, discountedPrice, imageUrl, videoUrl, ingredients, allergens, calories, prepTime, spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons, categoryId } = req.body;
  const badPrice = (price != null ? priceProblem(price, "Price") : null)
    ?? (discountedPrice != null ? priceProblem(discountedPrice, "Offer price") : null);
  if (badPrice) { res.status(400).json({ error: badPrice }); return; }
  // `discountedPrice` used to be forced to null whenever it was absent from the body, while
  // every other field was left alone when omitted. So an edit that only flipped "available"
  // silently cleared the item's offer price. It now clears only when explicitly sent as null.
  const nextDiscounted = discountedPrice === undefined
    ? undefined
    : discountedPrice === null ? null : String(discountedPrice);
  const [item] = await db.update(menuItemsTable).set({
    categoryId, name, description, imageUrl, videoUrl, ingredients, allergens, calories, prepTime,
    price: price != null ? String(price) : undefined, discountedPrice: nextDiscounted,
    spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons,
  }).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId))).returning();
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(parseItem(item));
});

router.delete("/restaurants/:restaurantId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const itemId = parseInt(String(req.params.itemId), 10);
  const [deleted] = await db.delete(menuItemsTable).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
  res.json({ message: "Item deleted" });
});

export default router;
