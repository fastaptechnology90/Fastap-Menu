import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable, categoriesTable, menuItemsTable, menuViewsTable, campaignsTable, feedbackTable } from "@workspace/db";
import { MENU_CATEGORY_CATALOG, DIETARY_FILTERS, DEFAULT_CUSTOMIZATION } from "../seed-menu-data.js";
import { buildUpsellSuggestions } from "../lib/ordering.js";
import { canAccessGuestVenue, getPublicationStatus, guestVenueAccessError } from "../lib/restaurant-publication.js";

const router: IRouter = Router();

function formatMenuItem(i: typeof menuItemsTable.$inferSelect) {
  const customizationOptions = {
    ...DEFAULT_CUSTOMIZATION,
    ...(typeof i.customizationOptions === "object" && i.customizationOptions !== null ? i.customizationOptions as Record<string, unknown> : {}),
  };
  return {
    ...i,
    price: parseFloat(i.price),
    discountedPrice: i.discountedPrice ? parseFloat(i.discountedPrice) : null,
    variants: Array.isArray(i.variants) ? i.variants : [],
    addons: Array.isArray(i.addons) ? i.addons : [],
    dietaryTags: Array.isArray(i.dietaryTags) ? i.dietaryTags : [],
    customizationOptions,
  };
}

router.get("/public/menu/:slug", async (req, res): Promise<void> => {
  try {
    const slug = req.params.slug;
    const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    if (!restaurant) { res.status(404).json({ error: "Menu not found" }); return; }
    if (!canAccessGuestVenue(restaurant)) {
      res.status(403).json({ error: guestVenueAccessError(getPublicationStatus(restaurant)) });
      return;
    }

    const tableParam = req.query.table as string | undefined;
    await db.insert(menuViewsTable).values({ restaurantId: restaurant.id, source: tableParam ? "qr" : "direct" }).catch(() => {});

    const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurant.id));
    const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));
    const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, restaurant.id)).catch(() => []);

    const activeCategories = categories.filter(c => c.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder);
    const categoriesWithItems = activeCategories.map(cat => ({
      ...cat,
      items: items.filter(i => i.categoryId === cat.id && i.isAvailable).map(formatMenuItem),
    }));

    const featuredItems = items.filter(i => i.isFeatured && i.isAvailable).map(formatMenuItem);

    const feedbackRows = await db.select({ rating: feedbackTable.rating, foodRating: feedbackTable.foodRating })
      .from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurant.id));
    const avgRating = feedbackRows.length
      ? feedbackRows.reduce((s, f) => s + (f.foodRating ?? f.rating), 0) / feedbackRows.length
      : 0;

    res.json({
      restaurant,
      avgRating: parseFloat(avgRating.toFixed(1)),
      table: tableParam ? { name: tableParam } : null,
      categories: categoriesWithItems,
      categoryGroups: MENU_CATEGORY_CATALOG,
      dietaryFilters: DIETARY_FILTERS,
      featuredItems,
      activeCampaigns: campaigns.filter(c => c.isActive),
    });
  } catch (err) {
    console.error("[public/menu]", err);
    res.status(503).json({ error: "Menu temporarily unavailable" });
  }
});

router.post("/public/suggest-upsell", async (req, res): Promise<void> => {
  const { restaurantId, cartCourses } = req.body;
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));
  const catSlug = Object.fromEntries(cats.map(c => [c.id, c.slug ?? ""]));
  const enriched = items.filter(i => i.isAvailable).map(i => ({
    id: i.id,
    name: i.name,
    categorySlug: catSlug[i.categoryId ?? 0] ?? "",
    isFeatured: i.isFeatured,
    orderCount: i.orderCount,
    price: parseFloat(i.price),
  }));
  const suggestions = buildUpsellSuggestions(Array.isArray(cartCourses) ? cartCourses : [], enriched);
  res.json({ suggestions });
});

export default router;
