/**
 * The menu, as the guest app sees it.
 *
 * The shape and every pricing rule below were lifted out of `MenuPage` unchanged when the
 * screen was rebuilt, so the dish sheet and the menu list read one definition instead of
 * two. The pricing comments are load-bearing: the guest's screen and the server's invoice
 * have to agree, and each of these rules is a case where they once did not.
 */
import type { DietaryFilter } from "@/contexts/UserContext";

export interface CustomizationOpts {
  extraCheese?: { label: string; price: number };
  extraSpicy?: { label: string; price: number };
  removeIngredients?: string[];
  portionSizes?: { name: string; price: number }[];
  toppings?: { name: string; price: number }[];
  comboUpgrades?: { name: string; price: number }[];
}

export interface MenuDisplayItem {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  price: number;
  dietaryTags: string[];
  rating: number;
  reviews: number;
  cookTime: string;
  /** Minutes the kitchen records for this dish, when it records one. */
  prepTime?: number;
  calories: number;
  protein: number;
  carbs: number;
  spice: number;
  badges: string[];
  desc: string;
  ingredients: string[];
  allergens: string[];
  prepMethod?: string;
  chefRecommended: boolean;
  imageUrl?: string;
  videoUrl?: string;
  preview360Url?: string;
  addons: { name: string; price: number }[];
  /**
   * Portions the kitchen actually offers, each with the FULL price of that portion (a
   * "Half" at ₹210 is ₹210, not ₹210 on top of the full price).
   */
  variants: { name: string; price: number }[];
  customizations: string[];
  customizationOptions: CustomizationOpts;
}

export type CategoryGroup = "all" | "food" | "beverage" | "special";
export type MenuSort = "default" | "price-asc" | "price-desc" | "rating" | "popular";

export interface MenuCategoryTab {
  id: string;
  label: string;
  group: string;
}

/** Vegetarian, by the dish's own dietary tags. Drives the green/red mark on every card. */
export function isVegItem(tags: string[]): boolean {
  const lower = tags.map(t => t.toLowerCase());
  return lower.some(t => t.includes("vegetarian") || t.includes("vegan") || t.includes("jain"))
    && !lower.some(t => t.includes("non-veg") || t.includes("non_veg"));
}

export function matchesDietaryFilter(tags: string[], filter: DietaryFilter): boolean {
  if (filter === "all") return true;
  const lower = tags.map(t => t.toLowerCase());
  const has = (...keys: string[]) => keys.some(k => lower.some(t => t.includes(k)));
  switch (filter) {
    case "veg": return has("vegetarian", "vegan", "jain") && !has("non-veg", "non_veg");
    case "non-veg": return has("non-veg", "non_veg") || (!has("vegetarian", "vegan", "jain") && lower.length === 0);
    case "jain": return has("jain");
    case "vegan": return has("vegan");
    case "gluten-free": return has("gluten-free", "gluten free");
    case "sugar-free": return has("sugar-free", "sugar free");
    case "keto": return has("keto");
    case "organic": return has("organic");
    case "nut-free": return has("nut-free", "nut free") || !lower.some(t => t.includes("nut"));
    case "dairy-free": return has("dairy-free", "dairy free", "vegan");
    default: return true;
  }
}

/**
 * Only what this dish itself declares.
 *
 * A shared default set used to be merged in here, so every item — coffee and kulfi
 * included — offered "Extra Cheese +₹15", "Large +₹25" and "Make it a combo meal +₹99".
 * The server prices strictly from the dish's own `addons`, so none of those were ever
 * actually charged: the guest picked an option, watched the total go up on screen, and
 * then got a different bill.
 */
function parseCustomization(raw: unknown): CustomizationOpts {
  if (typeof raw !== "object" || raw === null) return {};
  const o = raw as CustomizationOpts;
  // Priced extras (cheese, toppings, combos) belong on `addons` — the only list the
  // server bills. Keep free "leave out" notes when the menu API sends them.
  const remove = Array.isArray(o.removeIngredients)
    ? o.removeIngredients.map(String).map(s => s.trim()).filter(Boolean)
    : [];
  return remove.length > 0 ? { removeIngredients: remove } : {};
}

export function mapApiItem(
  i: Record<string, unknown>,
  categorySlug: string,
  categoryGroup = "food",
  restaurantRating = 0,
): MenuDisplayItem {
  const tags = Array.isArray(i.dietaryTags) ? i.dietaryTags as string[] : [];
  const badges: string[] = [];
  if (i.chefRecommended) badges.push("chef-recommended");
  if (i.isFeatured) badges.push("chef-special");
  if ((i.orderCount as number || 0) > 30) badges.push("bestseller");
  if ((i.viewCount as number || 0) > 100) badges.push("trending");
  const addons = Array.isArray(i.addons)
    ? (i.addons as Record<string, unknown>[]).map(a => ({ name: String(a.name ?? a), price: parseFloat(String(a.price ?? 0)) }))
    : [];
  // A variant row is {name, price} where price is the full price of that portion. Older
  // rows are bare strings with no price; those are shown but priced at the base rate,
  // which is exactly what the server will do with them.
  const basePrice = (i.discountedPrice as number) ?? parseFloat(String(i.price ?? 0));
  const variants = Array.isArray(i.variants)
    ? (i.variants as unknown[]).map(v =>
        typeof v === "object" && v !== null
          ? {
              name: String((v as Record<string, unknown>).name ?? ""),
              price: parseFloat(String((v as Record<string, unknown>).price ?? basePrice)) || basePrice,
            }
          : { name: String(v), price: basePrice },
      ).filter(v => v.name)
    : [];
  return {
    id: String(i.id),
    name: String(i.name),
    category: categorySlug,
    categoryGroup,
    price: basePrice,
    variants,
    dietaryTags: tags,
    rating: restaurantRating > 0 ? restaurantRating : 0,
    reviews: (i.orderCount as number) || 0,
    // A dish with no prep time recorded used to be labelled "15 min" on the card and in
    // the detail sheet. That number came from nowhere: the guest was told how long their
    // food would take by a literal in the source.
    cookTime: i.prepTime ? `${i.prepTime} min` : "",
    prepTime: typeof i.prepTime === "number" ? i.prepTime : undefined,
    calories: (i.calories as number) || 0,
    protein: (i.protein as number) || 0,
    carbs: (i.carbs as number) || 0,
    spice: (i.spiceLevel as number) ?? 0,
    badges,
    desc: String(i.description || ""),
    ingredients: i.ingredients ? String(i.ingredients).split(",").map(s => s.trim()).filter(Boolean) : [],
    allergens: i.allergens && i.allergens !== "none"
      ? String(i.allergens).split(",").map(s => s.trim()).filter(Boolean)
      : [],
    prepMethod: i.prepMethod ? String(i.prepMethod) : undefined,
    chefRecommended: Boolean(i.chefRecommended),
    imageUrl: i.imageUrl ? String(i.imageUrl) : undefined,
    videoUrl: i.videoUrl ? String(i.videoUrl) : undefined,
    preview360Url: i.preview360Url ? String(i.preview360Url) : undefined,
    addons,
    customizations: variants.map(v => v.name),
    customizationOptions: parseCustomization(i.customizationOptions),
  };
}

const BEVERAGE_SLUGS = [
  "soft-drinks", "coffee", "tea", "mocktails", "cocktails",
  "premium-liquor", "wine-menu", "beer-menu",
];

/** Which course a dish belongs to — the kitchen sequences the round by this. */
export function courseOf(categorySlug: string): "starter" | "main" | "dessert" | "beverage" {
  if (categorySlug === "starters") return "starter";
  if (categorySlug === "desserts") return "dessert";
  if (BEVERAGE_SLUGS.includes(categorySlug)) return "beverage";
  return "main";
}

export const BADGE_LABELS: Record<string, string> = {
  bestseller: "Bestseller",
  trending: "Trending",
  "chef-recommended": "Chef pick",
  "chef-special": "Chef special",
};

export function sortMenuItems(items: MenuDisplayItem[], sortBy: MenuSort): MenuDisplayItem[] {
  if (sortBy === "default") return items;
  return [...items].sort((a, b) => {
    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    if (sortBy === "rating") return b.rating - a.rating;
    return b.reviews - a.reviews;
  });
}
