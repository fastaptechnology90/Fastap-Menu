/** Curated Unsplash images — hospitality & food photography */
export const IMAGES = {
  heroRestaurant:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
  heroDining:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
  heroKitchen:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1400&q=80",
  adminMission:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  foodBowl:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  foodPasta:
    "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&q=80",
  foodDessert:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80",
  foodDrink:
    "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
  foodSnacks:
    "https://images.unsplash.com/photo-1601050690597-d9c3feba7431?auto=format&fit=crop&w=600&q=80",
  foodIndian:
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80",
  foodStarters:
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=80",
  foodMain:
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
  foodCoffee:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
  foodCocktail:
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7b1e?auto=format&fit=crop&w=600&q=80",
  hotelRoom:
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80",
  spa:
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80",
  bar:
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=80",
  qrScan:
    "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=80",
} as const;

export const MENU_FALLBACK_IMAGES = [
  IMAGES.foodBowl,
  IMAGES.foodIndian,
  IMAGES.foodStarters,
  IMAGES.foodDessert,
  IMAGES.foodDrink,
];

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  snacks: IMAGES.foodSnacks,
  starters: IMAGES.foodStarters,
  breakfast: IMAGES.foodBowl,
  lunch: IMAGES.foodIndian,
  dinner: IMAGES.foodMain,
  "main-course": IMAGES.foodMain,
  desserts: IMAGES.foodDessert,
  "kids-menu": IMAGES.foodBowl,
  "healthy-menu": IMAGES.foodStarters,
  "diet-menu": IMAGES.foodStarters,
  "soft-drinks": IMAGES.foodDrink,
  coffee: IMAGES.foodCoffee,
  tea: IMAGES.foodCoffee,
  mocktails: IMAGES.foodCocktail,
  cocktails: IMAGES.foodCocktail,
  "premium-liquor": IMAGES.bar,
  "wine-menu": IMAGES.foodCocktail,
  "beer-menu": IMAGES.bar,
  "festival-menu": IMAGES.foodIndian,
  "seasonal-menu": IMAGES.foodBowl,
  "chef-special": IMAGES.foodMain,
  "happy-hour-menu": IMAGES.foodCocktail,
  beverage: IMAGES.foodDrink,
  food: IMAGES.foodIndian,
};

export function menuFallbackImage(id: string | number, category?: string): string {
  if (category) {
    const key = category.toLowerCase().replace(/\s+/g, "-");
    for (const [slug, url] of Object.entries(CATEGORY_IMAGE_MAP)) {
      if (key.includes(slug)) return url;
    }
    if (/snack|samosa|pakora/i.test(category)) return IMAGES.foodSnacks;
    if (/dessert|sweet/i.test(category)) return IMAGES.foodDessert;
    if (/drink|beverage|juice|coffee|tea|bar/i.test(category)) return IMAGES.foodDrink;
    if (/starter|appet/i.test(category)) return IMAGES.foodStarters;
  }
  const n = typeof id === "string" ? id.charCodeAt(0) + id.length : id;
  return MENU_FALLBACK_IMAGES[Math.abs(n) % MENU_FALLBACK_IMAGES.length];
}
