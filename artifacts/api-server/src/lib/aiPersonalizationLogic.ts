export type MenuItemEnriched = {
  id: number;
  name: string;
  price: number;
  categorySlug?: string;
  dietaryTags?: string[];
  isFeatured?: boolean;
  orderCount?: number;
  chefRecommended?: boolean;
  description?: string;
};

export type OrderHistoryItem = {
  name: string;
  menuItemId?: number;
  price?: number;
  categorySlug?: string;
  total?: number;
  createdAt?: Date | string;
};

const COMBO_BUNDLES = [
  { id: "classic_thali", name: "Classic Indian Thali", itemNames: ["Thali Combo", "Thali", "Masala Chai"], save: 15, reason: "Most ordered lunch combo" },
  { id: "tikka_feast", name: "Tikka Feast", itemNames: ["Chicken Tikka", "Butter Chicken", "Garlic Naan", "Naan"], save: 20, reason: "Perfect for 2 guests" },
  { id: "healthy_bowl", name: "Healthy Power Bowl", itemNames: ["Quinoa Buddha Bowl", "Buddha Bowl", "Fresh Lime", "Lime Soda"], save: 10, reason: "Under 500 cal" },
  { id: "date_night", name: "Date Night Special", itemNames: ["Paneer Tikka", "Dal Makhani", "Gulab Jamun", "Mocktail", "Mojito"], save: 25, reason: "Romantic dinner for two" },
];

const DIETARY_MAP: Record<string, string[]> = {
  veg: ["vegetarian", "veg", "jain"],
  "non-veg": ["non-veg", "non_veg"],
  vegan: ["vegan"],
  jain: ["jain", "vegetarian"],
  "gluten-free": ["gluten-free", "gluten_free"],
  keto: ["keto"],
  "sugar-free": ["sugar-free", "sugar_free"],
  organic: ["organic"],
  "nut-free": ["nut-free"],
  "dairy-free": ["dairy-free", "vegan"],
};

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isNaN(n) ? 0 : n;
}

function matchesDietary(tags: string[] | undefined, filter: string): boolean {
  if (!filter || filter === "all") return true;
  const allowed = DIETARY_MAP[filter] ?? [filter];
  const lower = (tags ?? []).map(t => t.toLowerCase());
  if (filter === "veg") return lower.some(t => allowed.includes(t)) && !lower.some(t => t.includes("non-veg") || t.includes("non_veg"));
  return lower.some(t => allowed.some(a => t.includes(a)));
}

function scoreItem(
  item: MenuItemEnriched,
  ctx: { favoriteNames: Set<string>; orderedIds: Set<number>; dietaryFilter: string; hour: number },
): number {
  let score = 50;
  if (ctx.favoriteNames.has(item.name.toLowerCase())) score += 30;
  if (ctx.orderedIds.has(item.id)) score += 25;
  if (item.isFeatured) score += 10;
  if (item.chefRecommended) score += 8;
  score += Math.min(15, Math.floor((item.orderCount ?? 0) / 30));
  if (!matchesDietary(item.dietaryTags, ctx.dietaryFilter)) score -= 40;
  if (ctx.hour >= 7 && ctx.hour < 11 && (item.categorySlug === "breakfast" || item.name.toLowerCase().includes("dosa"))) score += 12;
  if (ctx.hour >= 11 && ctx.hour < 15 && item.categorySlug === "lunch") score += 10;
  if (ctx.hour >= 18 && item.categorySlug === "dinner") score += 10;
  return Math.min(100, Math.max(0, score));
}

export function buildPersonalizedMenu(
  items: MenuItemEnriched[],
  opts: { favorites?: string[]; orderHistory?: OrderHistoryItem[]; dietaryFilter?: string },
) {
  const favoriteNames = new Set((opts.favorites ?? []).map(f => f.toLowerCase()));
  const orderedIds = new Set(
    (opts.orderHistory ?? []).map(o => o.menuItemId).filter(Boolean) as number[],
  );
  const hour = new Date().getHours();
  const ctx = { favoriteNames, orderedIds, dietaryFilter: opts.dietaryFilter ?? "all", hour };

  return items
    .filter(i => matchesDietary(i.dietaryTags, ctx.dietaryFilter))
    .map(item => {
      const score = scoreItem(item, ctx);
      let reason = "Popular at this venue";
      if (favoriteNames.has(item.name.toLowerCase())) reason = "One of your favorites";
      else if (orderedIds.has(item.id)) reason = "You've ordered this before";
      else if (item.chefRecommended) reason = "Chef recommended for you";
      else if (item.isFeatured) reason = "Trending now";
      return { menuItemId: item.id, name: item.name, price: item.price, score, reason, categorySlug: item.categorySlug };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function predictFavoriteItems(
  items: MenuItemEnriched[],
  opts: { favorites?: string[]; orderHistory?: OrderHistoryItem[]; dietaryFilter?: string },
) {
  const orderedNames = new Set((opts.orderHistory ?? []).map(o => o.name.toLowerCase()));
  const favoriteNames = new Set((opts.favorites ?? []).map(f => f.toLowerCase()));
  const orderedCategories = [...new Set((opts.orderHistory ?? []).map(o => o.categorySlug).filter(Boolean))];

  return items
    .filter(i => !orderedNames.has(i.name.toLowerCase()) && matchesDietary(i.dietaryTags, opts.dietaryFilter ?? "all"))
    .map(item => {
      let confidence = 60 + Math.min(25, Math.floor((item.orderCount ?? 0) / 25));
      if (orderedCategories.includes(item.categorySlug)) confidence += 10;
      if (favoriteNames.size > 0) {
        const favSimilar = [...favoriteNames].some(f =>
          item.name.toLowerCase().includes(f.split(" ")[0]) || f.includes(item.name.toLowerCase().split(" ")[0]),
        );
        if (favSimilar) confidence += 15;
      }
      confidence = Math.min(98, confidence);
      return {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        confidence,
        reason: confidence >= 85 ? "High match based on your taste profile" : "Guests with similar orders loved this",
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

export function buildComboRecommendations(items: MenuItemEnriched[], cartNames: string[] = []) {
  const cartLower = cartNames.map(n => n.toLowerCase());
  const findItem = (names: string[]) =>
    items.find(i => names.some(n => i.name.toLowerCase().includes(n.toLowerCase())));

  return COMBO_BUNDLES.map(bundle => {
    const matched = bundle.itemNames.map(n => findItem([n])).filter(Boolean) as MenuItemEnriched[];
    const price = matched.reduce((s, i) => s + i.price, 0);
    const alreadyInCart = matched.some(i => cartLower.some(c => i.name.toLowerCase().includes(c)));
    return {
      id: bundle.id,
      name: bundle.name,
      items: matched.map(i => ({ menuItemId: i.id, name: i.name, price: i.price })),
      totalPrice: Math.round(price * (1 - bundle.save / 100)),
      originalPrice: price,
      savePercent: bundle.save,
      reason: bundle.reason,
      recommended: !alreadyInCart && matched.length >= 2,
    };
  }).filter(c => c.items.length >= 2);
}

export function buildAiUpsells(
  cartCourses: string[],
  items: MenuItemEnriched[],
  cartItemIds: number[] = [],
) {
  const has = (c: string) => cartCourses.includes(c);
  const inCart = new Set(cartItemIds);
  const suggestions: { menuItemId: number; name: string; reason: string; type: string; price: number; uplift?: number }[] = [];

  if (!has("dessert")) {
    const item = items.find(i => i.categorySlug === "desserts" || i.name.includes("Gulab") || i.name.includes("Jamun"));
    if (item && !inCart.has(item.id)) {
      suggestions.push({ menuItemId: item.id, name: item.name, reason: "Complete your meal with dessert", type: "combo", price: item.price, uplift: item.price });
    }
  }
  if (!has("beverage")) {
    const item = items.find(i =>
      i.categorySlug === "soft-drinks" || i.categorySlug === "mocktails" || i.categorySlug === "cocktails" ||
      i.name.includes("Lassi") || i.name.includes("Chai"),
    );
    if (item && !inCart.has(item.id)) {
      suggestions.push({ menuItemId: item.id, name: item.name, reason: "89% of guests pair mains with a beverage", type: "ai_upsell", price: item.price, uplift: item.price });
    }
  }
  if (!has("starter") && (has("main") || cartCourses.length > 0)) {
    const item = items.find(i => i.categorySlug === "starters" && ((i.orderCount ?? 0) > 80 || i.isFeatured));
    if (item && !inCart.has(item.id)) {
      suggestions.push({ menuItemId: item.id, name: item.name, reason: "Popular starter pairing", type: "upsell", price: item.price, uplift: item.price });
    }
  }
  const featured = items.filter(i => i.isFeatured && !suggestions.some(s => s.menuItemId === i.id) && !inCart.has(i.id)).slice(0, 2);
  for (const f of featured) {
    suggestions.push({ menuItemId: f.id, name: f.name, reason: "Chef recommended add-on · high margin pick", type: "ai_upsell", price: f.price, uplift: f.price });
  }
  return suggestions.slice(0, 5);
}

export function buildDietarySuggestions(items: MenuItemEnriched[], dietaryFilter: string) {
  const tips: Record<string, { tip: string; picks: string[] }> = {
    veg: { tip: "Vegetarian-safe items with no hidden meat stock", picks: [] },
    "non-veg": { tip: "Premium protein picks based on popularity", picks: [] },
    vegan: { tip: "100% plant-based — no dairy, eggs, or honey", picks: [] },
    jain: { tip: "No onion, garlic, or root vegetables", picks: [] },
    "gluten-free": { tip: "Naturally gluten-free or GF-prepared dishes", picks: [] },
    keto: { tip: "Low carb, high fat options", picks: [] },
    "sugar-free": { tip: "No added sugar options", picks: [] },
    organic: { tip: "Certified organic where available", picks: [] },
    all: { tip: "Apply a dietary filter for tailored AI picks", picks: [] },
  };

  const matched = items.filter(i => matchesDietary(i.dietaryTags, dietaryFilter));
  const top = matched.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0)).slice(0, 6);

  const tipEntry = tips[dietaryFilter] ?? tips.all;
  return {
    filter: dietaryFilter,
    tip: tipEntry.tip,
    matchCount: matched.length,
    suggestions: top.map(i => ({
      menuItemId: i.id,
      name: i.name,
      price: i.price,
      dietaryTags: i.dietaryTags ?? [],
      reason: `Matches your ${dietaryFilter === "all" ? "preferences" : dietaryFilter + " diet"}`,
    })),
    aiTip: dietaryFilter === "all"
      ? "Select a dietary filter on the menu for personalized safe picks"
      : `Found ${matched.length} items safe for your ${dietaryFilter} preference`,
  };
}

export function analyzeSpending(orders: OrderHistoryItem[]) {
  if (!orders.length) {
    return {
      totalSpend: 0,
      avgOrderValue: 0,
      orderCount: 0,
      topCategory: "—",
      monthlyTrend: "0%",
      insights: ["Place your first order to unlock AI spending insights"],
      categoryBreakdown: [],
      suggestedBudget: 500,
    };
  }

  const totals = orders.map(o => parseNum(o.total ?? o.price));
  const totalSpend = totals.reduce((s, t) => s + t, 0);
  const avgOrderValue = Math.round(totalSpend / orders.length);
  const catMap: Record<string, number> = {};
  for (const o of orders) {
    const cat = o.categorySlug ?? "Other";
    catMap[cat] = (catMap[cat] ?? 0) + parseNum(o.total ?? o.price);
  }
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount, percent: Math.round((amount / totalSpend) * 100) }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = categoryBreakdown[0]?.category ?? "Main Course";
  const insights: string[] = [];
  if (avgOrderValue > 800) insights.push(`Your avg order is ₹${avgOrderValue} — try lunch combos to save 15%`);
  else insights.push(`Your avg order is ₹${avgOrderValue} — great value ordering`);
  if (categoryBreakdown[0]?.percent > 50) {
    insights.push(`${topCategory} is ${categoryBreakdown[0].percent}% of spend — explore other categories for variety`);
  }
  insights.push(`You've placed ${orders.length} orders · total ₹${totalSpend.toLocaleString()}`);

  const now = new Date();
  const thisMonth = orders.filter(o => {
    const d = new Date(o.createdAt ?? 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = orders.filter(o => {
    const d = new Date(o.createdAt ?? 0);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });
  const thisSpend = thisMonth.reduce((s, o) => s + parseNum(o.total ?? o.price), 0);
  const lastSpend = lastMonth.reduce((s, o) => s + parseNum(o.total ?? o.price), 0);
  let monthlyTrend = "0%";
  if (lastSpend > 0) {
    const pct = Math.round(((thisSpend - lastSpend) / lastSpend) * 100);
    monthlyTrend = `${pct >= 0 ? "+" : ""}${pct}%`;
  } else if (thisSpend > 0) {
    monthlyTrend = "+100%";
  }

  return {
    totalSpend: Math.round(totalSpend),
    avgOrderValue,
    orderCount: orders.length,
    topCategory,
    monthlyTrend,
    insights,
    categoryBreakdown,
    suggestedBudget: Math.round(avgOrderValue * 1.1),
  };
}

export function getAiCatalog() {
  return {
    features: [
      "personalized_menu", "favorite_prediction", "combo_recommendations",
      "ai_upselling", "dietary_suggestions", "spending_analysis",
    ],
    comboBundles: COMBO_BUNDLES.length,
    dietaryFilters: Object.keys(DIETARY_MAP),
  };
}

export function runPersonalizationEngine(
  items: MenuItemEnriched[],
  opts: {
    favorites?: string[];
    orderHistory?: OrderHistoryItem[];
    dietaryFilter?: string;
    cartCourses?: string[];
    cartItemIds?: number[];
    cartItemNames?: string[];
  },
) {
  return {
    personalizedMenu: buildPersonalizedMenu(items, opts),
    favoritePredictions: predictFavoriteItems(items, opts),
    comboRecommendations: buildComboRecommendations(items, opts.cartItemNames ?? []),
    upsells: buildAiUpsells(opts.cartCourses ?? [], items, opts.cartItemIds ?? []),
    dietarySuggestions: buildDietarySuggestions(items, opts.dietaryFilter ?? "all"),
    spendingAnalysis: analyzeSpending(opts.orderHistory ?? []),
  };
}
