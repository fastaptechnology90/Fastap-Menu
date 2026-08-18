/** Advanced ordering catalog — API mirror */
export const ORDER_TYPES = [
  { id: "dine-in", apiType: "dine_in" },
  { id: "takeaway", apiType: "takeaway" },
  { id: "drive-in", apiType: "drive_in" },
  { id: "drive-through", apiType: "drive_through" },
  { id: "room-service", apiType: "room_service" },
  { id: "poolside", apiType: "poolside" },
  { id: "spa", apiType: "spa" },
  { id: "bar", apiType: "bar" },
  { id: "lounge", apiType: "lounge" },
  { id: "event", apiType: "event" },
  { id: "cabana", apiType: "cabana" },
] as const;

export const ORDER_TYPE_MAP = Object.fromEntries(ORDER_TYPES.map(t => [t.id, t.apiType]));

export function buildUpsellSuggestions(
  cartCourses: string[],
  menuItems: { id: number; name: string; categorySlug?: string; isFeatured?: boolean; orderCount?: number }[],
) {
  const has = (c: string) => cartCourses.includes(c);
  const suggestions: { menuItemId: number; name: string; reason: string; type: string }[] = [];

  if (!has("dessert")) {
    const item = menuItems.find(i => i.categorySlug === "desserts" || i.name.toLowerCase().includes("dessert") || i.name.includes("Gulab"));
    if (item) suggestions.push({ menuItemId: item.id, name: item.name, reason: "Complete your meal with dessert", type: "combo" });
  }
  if (!has("beverage")) {
    const item = menuItems.find(i => i.categorySlug === "soft-drinks" || i.categorySlug === "mocktails" || i.name.includes("Lassi"));
    if (item) suggestions.push({ menuItemId: item.id, name: item.name, reason: "Add a refreshing beverage", type: "upsell" });
  }
  if (!has("starter") && cartCourses.includes("main")) {
    const item = menuItems.find(i => i.categorySlug === "starters" && (i.isFeatured || (i.orderCount ?? 0) > 100));
    if (item) suggestions.push({ menuItemId: item.id, name: item.name, reason: "Popular starter pairing", type: "upsell" });
  }
  const featured = menuItems.filter(i => i.isFeatured && !suggestions.some(s => s.menuItemId === i.id)).slice(0, 2);
  for (const f of featured) {
    suggestions.push({ menuItemId: f.id, name: f.name, reason: "Chef recommended add-on", type: "ai_upsell" });
  }
  return suggestions.slice(0, 4);
}
