/** Shared digital menu catalog — used by API seed and frontend demo */
export const MENU_CATEGORY_CATALOG = {
  food: {
    label: "Food Categories",
    categories: [
      { name: "Breakfast", slug: "breakfast", sortOrder: 1 },
      { name: "Lunch", slug: "lunch", sortOrder: 2 },
      { name: "Dinner", slug: "dinner", sortOrder: 3 },
      { name: "Snacks", slug: "snacks", sortOrder: 4 },
      { name: "Starters", slug: "starters", sortOrder: 5 },
      { name: "Main Course", slug: "main-course", sortOrder: 6 },
      { name: "Desserts", slug: "desserts", sortOrder: 7 },
      { name: "Kids Menu", slug: "kids-menu", sortOrder: 8 },
      { name: "Healthy Menu", slug: "healthy-menu", sortOrder: 9 },
      { name: "Diet Menu", slug: "diet-menu", sortOrder: 10 },
    ],
  },
  beverage: {
    label: "Beverage Categories",
    categories: [
      { name: "Soft Drinks", slug: "soft-drinks", sortOrder: 11 },
      { name: "Coffee", slug: "coffee", sortOrder: 12 },
      { name: "Tea", slug: "tea", sortOrder: 13 },
      { name: "Mocktails", slug: "mocktails", sortOrder: 14 },
      { name: "Cocktails", slug: "cocktails", sortOrder: 15 },
      { name: "Premium Liquor", slug: "premium-liquor", sortOrder: 16 },
      { name: "Wine Menu", slug: "wine-menu", sortOrder: 17 },
      { name: "Beer Menu", slug: "beer-menu", sortOrder: 18 },
    ],
  },
  special: {
    label: "Special Menus",
    categories: [
      { name: "Festival Menu", slug: "festival-menu", sortOrder: 19 },
      { name: "Seasonal Menu", slug: "seasonal-menu", sortOrder: 20 },
      { name: "Chef Special", slug: "chef-special", sortOrder: 21 },
      { name: "Happy Hour Menu", slug: "happy-hour-menu", sortOrder: 22 },
      { name: "Midnight Menu", slug: "midnight-menu", sortOrder: 23 },
      { name: "Poolside Menu", slug: "poolside-menu", sortOrder: 24 },
      { name: "Spa Wellness Menu", slug: "spa-wellness-menu", sortOrder: 25 },
      { name: "Banquet Menu", slug: "banquet-menu", sortOrder: 26 },
    ],
  },
} as const;

export const DIETARY_FILTERS = [
  { id: "all", label: "All", emoji: "🍽️", color: "bg-white/10 text-white/70" },
  { id: "veg", label: "Veg", emoji: "🟢", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: "non-veg", label: "Non-Veg", emoji: "🔴", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: "jain", label: "Jain", emoji: "☯", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: "vegan", label: "Vegan", emoji: "🌿", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { id: "gluten-free", label: "Gluten Free", emoji: "🌾", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "sugar-free", label: "Sugar Free", emoji: "🚫", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "keto", label: "Keto", emoji: "⚡", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "organic", label: "Organic", emoji: "🌱", color: "bg-lime-500/20 text-lime-400 border-lime-500/30" },
  { id: "nut-free", label: "Nut Free", emoji: "🥜", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "dairy-free", label: "Dairy Free", emoji: "🥛", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
] as const;

export const DEFAULT_CUSTOMIZATION = {
  extraCheese: { label: "Extra Cheese", price: 15 },
  extraSpicy: { label: "Extra Spicy", price: 0 },
  removeIngredients: ["No onion", "No garlic", "No dairy", "No nuts"],
  portionSizes: [{ name: "Regular", price: 0 }, { name: "Large", price: 25 }],
  toppings: [{ name: "Extra toppings", price: 12 }],
  comboUpgrades: [{ name: "Make it a combo meal", price: 99 }],
};

export type MenuItemSeed = {
  categorySlug: string;
  name: string;
  description: string;
  price: string;
  spiceLevel?: number;
  dietaryTags: string[];
  isFeatured?: boolean;
  orderCount?: number;
  viewCount?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  prepTime?: number;
  prepMethod?: string;
  ingredients?: string;
  allergens?: string;
  imageUrl?: string;
  videoUrl?: string;
  preview360Url?: string;
  chefRecommended?: boolean;
  variants?: unknown[];
  addons?: unknown[];
  customizationOptions?: Record<string, unknown>;
};

export const MENU_ITEMS_SEED: MenuItemSeed[] = [
  { categorySlug: "breakfast", name: "Masala Dosa", description: "Crispy rice crepe with spiced potato filling, served with chutney", price: "28", dietaryTags: ["vegetarian", "gluten-free"], calories: 320, protein: 8, carbs: 52, prepTime: 15, prepMethod: "Tawa grilled", ingredients: "Rice batter, potato, mustard seeds, curry leaves", allergens: "none", isFeatured: true, orderCount: 210, chefRecommended: true, variants: ["Regular", "Large"], addons: [{ name: "Extra Sambar", price: 8 }] },
  { categorySlug: "breakfast", name: "English Breakfast Platter", description: "Eggs, baked beans, toast, grilled tomato and mushrooms", price: "45", dietaryTags: ["non-veg"], calories: 580, protein: 28, carbs: 42, prepTime: 18, prepMethod: "Pan fried & grilled", ingredients: "Eggs, beans, bread, tomato, mushroom", allergens: "gluten, egg", orderCount: 89 },
  { categorySlug: "lunch", name: "Thali Combo", description: "Complete Indian lunch with dal, sabzi, roti, rice and dessert", price: "55", dietaryTags: ["vegetarian"], calories: 720, protein: 22, carbs: 95, prepTime: 20, prepMethod: "Multi-station prep", isFeatured: true, orderCount: 340, variants: ["Standard", "Premium"], addons: [{ name: "Extra Roti", price: 6 }] },
  { categorySlug: "dinner", name: "Tandoori Mixed Grill", description: "Assorted tandoor-grilled kebabs with mint chutney", price: "85", dietaryTags: ["non-veg", "gluten-free"], calories: 640, protein: 45, carbs: 12, prepTime: 25, prepMethod: "Tandoor roasted", spiceLevel: 2, isFeatured: true, orderCount: 280, chefRecommended: true },
  { categorySlug: "snacks", name: "Vada Pav", description: "Mumbai street-style potato fritter in soft bun with chutneys", price: "18", dietaryTags: ["vegetarian"], calories: 280, protein: 6, carbs: 38, prepTime: 8, prepMethod: "Deep fried", orderCount: 420, viewCount: 1200 },
  { categorySlug: "starters", name: "Chicken Tikka", description: "Tender chicken marinated in yogurt and spices, grilled in tandoor", price: "45", spiceLevel: 2, dietaryTags: ["non-veg", "gluten-free"], calories: 290, protein: 32, carbs: 8, prepTime: 18, prepMethod: "Tandoor grilled", isFeatured: true, orderCount: 220, viewCount: 890, chefRecommended: true, variants: ["Half", "Full"], addons: [{ name: "Extra Mint Chutney", price: 5 }, { name: "Extra Cheese", price: 15 }] },
  { categorySlug: "starters", name: "Samosa Platter", description: "Crispy fried pastry filled with spiced potatoes and peas", price: "22", spiceLevel: 1, dietaryTags: ["vegetarian", "jain"], calories: 240, protein: 5, carbs: 28, prepTime: 12, orderCount: 145, viewCount: 650 },
  { categorySlug: "main-course", name: "Butter Chicken", description: "Creamy tomato-based curry with tender chicken pieces", price: "65", spiceLevel: 1, dietaryTags: ["non-veg", "gluten-free"], calories: 480, protein: 38, carbs: 18, prepTime: 22, prepMethod: "Slow simmered", isFeatured: true, orderCount: 312, viewCount: 1500, chefRecommended: true, variants: ["Regular", "Large"], addons: [{ name: "Extra Gravy", price: 10 }] },
  { categorySlug: "main-course", name: "Palak Paneer", description: "Fresh cottage cheese cubes in smooth spinach gravy", price: "48", spiceLevel: 1, dietaryTags: ["vegetarian", "gluten-free"], calories: 380, protein: 18, carbs: 22, prepTime: 20, prepMethod: "Simmered", orderCount: 134 },
  { categorySlug: "desserts", name: "Gulab Jamun", description: "Soft milk-solid dumplings soaked in rose-flavored sugar syrup", price: "22", dietaryTags: ["vegetarian"], calories: 320, protein: 4, carbs: 58, prepTime: 5, isFeatured: true, orderCount: 234, viewCount: 400 },
  { categorySlug: "desserts", name: "Sugar-Free Sorbet", description: "Refreshing mango sorbet with no added sugar", price: "26", dietaryTags: ["vegan", "sugar-free", "dairy-free"], calories: 90, protein: 1, carbs: 22, prepTime: 3, orderCount: 67 },
  { categorySlug: "kids-menu", name: "Mini Pizza", description: "Kid-sized margherita pizza with mild cheese", price: "25", dietaryTags: ["vegetarian"], calories: 350, protein: 12, carbs: 45, prepTime: 12, orderCount: 156 },
  { categorySlug: "kids-menu", name: "Chicken Nuggets & Fries", description: "Crispy nuggets with golden fries and ketchup", price: "32", dietaryTags: ["non-veg"], calories: 420, protein: 18, carbs: 38, prepTime: 14, orderCount: 198 },
  { categorySlug: "healthy-menu", name: "Quinoa Buddha Bowl", description: "Quinoa, roasted veggies, chickpeas, tahini dressing", price: "42", dietaryTags: ["vegan", "gluten-free", "organic"], calories: 380, protein: 14, carbs: 48, prepTime: 12, prepMethod: "Fresh assembled", isFeatured: true, orderCount: 112 },
  { categorySlug: "healthy-menu", name: "Grilled Salmon Salad", description: "Atlantic salmon on mixed greens with lemon vinaigrette", price: "68", dietaryTags: ["non-veg", "keto", "gluten-free", "dairy-free"], calories: 420, protein: 35, carbs: 8, prepTime: 15, orderCount: 88 },
  { categorySlug: "diet-menu", name: "Keto Chicken Bowl", description: "Grilled chicken, avocado, greens, no carbs", price: "52", dietaryTags: ["non-veg", "keto", "gluten-free"], calories: 450, protein: 40, carbs: 6, prepTime: 14, orderCount: 76 },
  { categorySlug: "diet-menu", name: "Jain Thali", description: "No onion, no garlic, no root vegetables — pure Jain meal", price: "48", dietaryTags: ["vegetarian", "jain", "vegan"], calories: 520, protein: 16, carbs: 78, prepTime: 18, orderCount: 54 },
  { categorySlug: "soft-drinks", name: "Fresh Lime Soda", description: "Freshly squeezed lime with soda water", price: "14", dietaryTags: ["vegan", "gluten-free", "sugar-free"], calories: 45, carbs: 10, prepTime: 3, orderCount: 198 },
  { categorySlug: "soft-drinks", name: "Mango Lassi", description: "Creamy yogurt drink blended with fresh mangoes", price: "20", dietaryTags: ["vegetarian"], calories: 180, protein: 6, carbs: 28, prepTime: 5, isFeatured: true, orderCount: 312 },
  { categorySlug: "coffee", name: "Cappuccino", description: "Espresso with steamed milk and foam", price: "22", dietaryTags: ["vegetarian"], calories: 120, protein: 4, carbs: 10, prepTime: 4, prepMethod: "Espresso machine", variants: ["Regular", "Large"], addons: [{ name: "Extra shot", price: 15 }] },
  { categorySlug: "coffee", name: "Cold Brew", description: "Slow-steeped cold coffee served over ice", price: "24", dietaryTags: ["vegan", "dairy-free"], calories: 5, prepTime: 3, orderCount: 145 },
  { categorySlug: "tea", name: "Masala Chai", description: "Spiced Indian tea brewed with ginger and cardamom", price: "12", dietaryTags: ["vegetarian"], calories: 80, prepTime: 5, orderCount: 289 },
  { categorySlug: "tea", name: "Green Tea Detox", description: "Organic green tea with lemongrass", price: "14", dietaryTags: ["vegan", "organic", "sugar-free"], calories: 2, prepTime: 4, orderCount: 98 },
  { categorySlug: "mocktails", name: "Virgin Mojito", description: "Mint, lime, soda — refreshing alcohol-free", price: "18", dietaryTags: ["vegan", "gluten-free"], calories: 90, prepTime: 4, isFeatured: true, orderCount: 167 },
  { categorySlug: "mocktails", name: "Passion Fruit Cooler", description: "Tropical passion fruit with sparkling water", price: "20", dietaryTags: ["vegan"], calories: 110, prepTime: 4, orderCount: 134 },
  { categorySlug: "cocktails", name: "Spice Garden Mojito", description: "Rum, mint, lime, house spice blend", price: "35", dietaryTags: [], calories: 180, prepTime: 5, orderCount: 210, viewCount: 500 },
  { categorySlug: "cocktails", name: "Smoky Old Fashioned", description: "Bourbon, bitters, orange peel", price: "42", dietaryTags: [], calories: 160, prepTime: 5, chefRecommended: true, orderCount: 89 },
  { categorySlug: "premium-liquor", name: "Single Malt Whisky", description: "Premium 12-year single malt — 30ml", price: "65", dietaryTags: ["vegan", "gluten-free"], prepTime: 1, orderCount: 45 },
  { categorySlug: "wine-menu", name: "House Red Wine", description: "Medium-bodied Cabernet — glass", price: "38", dietaryTags: ["vegan"], orderCount: 78 },
  { categorySlug: "wine-menu", name: "Sparkling Prosecco", description: "Italian sparkling wine — glass", price: "42", dietaryTags: ["vegan"], orderCount: 92, isFeatured: true },
  { categorySlug: "beer-menu", name: "Craft Lager", description: "Local craft lager on tap — pint", price: "28", dietaryTags: ["vegan"], orderCount: 156 },
  { categorySlug: "beer-menu", name: "Wheat Beer", description: "Light Belgian-style wheat beer", price: "30", dietaryTags: ["vegan"], orderCount: 88 },
  { categorySlug: "festival-menu", name: "Diwali Sweets Platter", description: "Assorted festival mithai — limited season", price: "35", dietaryTags: ["vegetarian"], calories: 450, isFeatured: true, orderCount: 200, viewCount: 800 },
  { categorySlug: "seasonal-menu", name: "Winter Pumpkin Soup", description: "Roasted pumpkin soup with croutons", price: "24", dietaryTags: ["vegetarian"], calories: 180, prepTime: 10, orderCount: 67 },
  { categorySlug: "chef-special", name: "Chef's Truffle Biryani", description: "Aromatic biryani with truffle oil — chef's signature", price: "95", spiceLevel: 1, dietaryTags: ["non-veg"], calories: 620, protein: 28, carbs: 72, prepTime: 30, prepMethod: "Dum cooked", isFeatured: true, orderCount: 445, viewCount: 2000, chefRecommended: true },
  { categorySlug: "happy-hour-menu", name: "HH Chicken Wings", description: "Spicy wings at happy hour price — 4-7 PM", price: "25", dietaryTags: ["non-veg"], spiceLevel: 2, calories: 380, orderCount: 320, viewCount: 600 },
  { categorySlug: "midnight-menu", name: "Midnight Maggi", description: "Spicy masala instant noodles — late night favourite", price: "15", dietaryTags: ["vegetarian"], calories: 340, prepTime: 8, orderCount: 890, viewCount: 3000 },
  { categorySlug: "poolside-menu", name: "Poolside Fruit Platter", description: "Fresh seasonal fruits with honey drizzle", price: "32", dietaryTags: ["vegan", "gluten-free", "organic"], calories: 150, prepTime: 5, orderCount: 145 },
  { categorySlug: "poolside-menu", name: "Grilled Fish Tacos", description: "Light fish tacos perfect by the pool", price: "48", dietaryTags: ["non-veg", "dairy-free"], calories: 380, protein: 28, prepTime: 12, orderCount: 98 },
  { categorySlug: "spa-wellness-menu", name: "Detox Green Smoothie", description: "Spinach, kale, apple, ginger — spa wellness", price: "28", dietaryTags: ["vegan", "organic", "sugar-free", "gluten-free"], calories: 120, protein: 4, carbs: 22, prepTime: 4, orderCount: 76 },
  { categorySlug: "spa-wellness-menu", name: "Herbal Wellness Tea", description: "Chamomile, lavender, honey — calming blend", price: "16", dietaryTags: ["vegetarian", "organic"], calories: 15, prepTime: 5, orderCount: 54 },
  { categorySlug: "banquet-menu", name: "Banquet Veg Platter", description: "Assorted vegetarian starters for events — serves 4", price: "120", dietaryTags: ["vegetarian", "jain"], calories: 800, prepTime: 25, orderCount: 34 },
  { categorySlug: "banquet-menu", name: "Banquet Non-Veg Feast", description: "Premium non-veg platter for banquets — serves 4", price: "180", dietaryTags: ["non-veg"], calories: 1200, protein: 65, prepTime: 30, isFeatured: true, orderCount: 28 },
];

export function allCategorySeeds() {
  return Object.entries(MENU_CATEGORY_CATALOG).flatMap(([group, meta]) =>
    meta.categories.map(c => ({ ...c, categoryGroup: group })),
  );
}
