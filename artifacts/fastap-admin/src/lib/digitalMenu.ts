import { MENU_CATEGORY_CATALOG, DIETARY_FILTERS, DEFAULT_CUSTOMIZATION, MENU_ITEMS_SEED, allCategorySeeds } from "./digitalMenuCatalog";

export { MENU_CATEGORY_CATALOG, DIETARY_FILTERS, DEFAULT_CUSTOMIZATION, MENU_ITEMS_SEED, allCategorySeeds };

const DEMO_MEDIA: Record<string, { imageUrl?: string; videoUrl?: string; preview360Url?: string }> = {
  "Chicken Tikka": {
    imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    preview360Url: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=1200&q=80",
  },
  "Butter Chicken": {
    imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80",
    preview360Url: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=1200&q=80",
  },
  "Chef's Truffle Biryani": {
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&q=80",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    preview360Url: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=1200&q=80",
  },
  "Masala Dosa": {
    imageUrl: "https://images.unsplash.com/photo-1630384069060-08688b673b4d?w=800&q=80",
  },
  "Virgin Mojito": {
    imageUrl: "https://images.unsplash.com/photo-1551538827-9c037cb70832?w=800&q=80",
  },
};

export function getDemoMenu(table?: string) {
  const items = MENU_ITEMS_SEED;
  const catSeeds = allCategorySeeds();
  const categories = catSeeds.map((c, idx) => ({
    id: idx + 1,
    name: c.name,
    slug: c.slug,
    categoryGroup: c.categoryGroup,
    items: items.filter(i => i.categorySlug === c.slug).map((i, j) => {
      const media = DEMO_MEDIA[i.name] ?? {};
      return {
        id: idx * 100 + j + 1,
        name: i.name,
        description: i.description,
        price: parseFloat(i.price),
        spiceLevel: i.spiceLevel ?? 0,
        dietaryTags: i.dietaryTags,
        isFeatured: i.isFeatured ?? false,
        orderCount: i.orderCount ?? 0,
        viewCount: i.viewCount ?? 0,
        prepTime: i.prepTime,
        prepMethod: i.prepMethod,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        ingredients: i.ingredients,
        allergens: i.allergens,
        chefRecommended: i.chefRecommended ?? false,
        imageUrl: i.imageUrl ?? media.imageUrl,
        videoUrl: i.videoUrl ?? media.videoUrl,
        preview360Url: i.preview360Url ?? media.preview360Url,
        variants: i.variants ?? [],
        addons: i.addons ?? [],
        customizationOptions: { ...DEFAULT_CUSTOMIZATION, ...(i.customizationOptions ?? {}) },
      };
    }),
  }));

  const featuredItems = categories.flatMap(c => c.items).filter(i => i.isFeatured);

  return {
    restaurant: { name: "Spice Garden", slug: "spice-garden" },
    table: table ? { name: table } : { name: "T-12" },
    categories,
    categoryGroups: MENU_CATEGORY_CATALOG,
    dietaryFilters: DIETARY_FILTERS,
    featuredItems,
  };
}
