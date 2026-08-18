import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, categoriesTable, menuItemsTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

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

router.get("/restaurants/:restaurantId/categories", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));
  res.json(cats);
});

router.post("/restaurants/:restaurantId/categories", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo } = req.body;
  const [cat] = await db.insert(categoriesTable).values({ restaurantId, name, imageUrl, sortOrder: sortOrder ?? 0, isAvailable: isAvailable ?? true, availableFrom, availableTo }).returning();
  res.status(201).json(cat);
});

router.put("/restaurants/:restaurantId/categories/:categoryId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const categoryId = parseInt(req.params.categoryId, 10);
  const { name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo } = req.body;
  const [cat] = await db.update(categoriesTable).set({ name, imageUrl, sortOrder, isAvailable, availableFrom, availableTo }).where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.restaurantId, restaurantId))).returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(cat);
});

router.delete("/restaurants/:restaurantId/categories/:categoryId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const categoryId = parseInt(req.params.categoryId, 10);
  const [deleted] = await db.delete(categoriesTable).where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ message: "Category deleted" });
});

router.get("/restaurants/:restaurantId/items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
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
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const [item] = await db.select().from(menuItemsTable).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId)));
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(parseItem(item));
});

router.post("/restaurants/:restaurantId/items", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, description, price, discountedPrice, imageUrl, videoUrl, ingredients, allergens, calories, prepTime, spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons, categoryId } = req.body;
  const [item] = await db.insert(menuItemsTable).values({
    restaurantId, categoryId, name, description, imageUrl, videoUrl, ingredients, allergens, calories, prepTime,
    price: String(price), discountedPrice: discountedPrice != null ? String(discountedPrice) : null,
    spiceLevel: spiceLevel ?? 0, dietaryTags: dietaryTags ?? [], isAvailable: isAvailable ?? true,
    isFeatured: isFeatured ?? false, sortOrder: sortOrder ?? 0, variants: variants ?? [], addons: addons ?? [],
  }).returning();
  res.status(201).json(parseItem(item));
});

router.put("/restaurants/:restaurantId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const { name, description, price, discountedPrice, imageUrl, videoUrl, ingredients, allergens, calories, prepTime, spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons, categoryId } = req.body;
  const [item] = await db.update(menuItemsTable).set({
    categoryId, name, description, imageUrl, videoUrl, ingredients, allergens, calories, prepTime,
    price: price != null ? String(price) : undefined, discountedPrice: discountedPrice != null ? String(discountedPrice) : null,
    spiceLevel, dietaryTags, isAvailable, isFeatured, sortOrder, variants, addons,
  }).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId))).returning();
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(parseItem(item));
});

router.delete("/restaurants/:restaurantId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const [deleted] = await db.delete(menuItemsTable).where(and(eq(menuItemsTable.id, itemId), eq(menuItemsTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Item not found" }); return; }
  res.json({ message: "Item deleted" });
});

export default router;
