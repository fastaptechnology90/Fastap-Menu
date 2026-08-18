export const HAPPY_HOUR = {
  label: "Happy Hour",
  days: "Mon – Fri",
  start: "16:00",
  end: "19:00",
  discountPercent: 20,
};

export const DJ_EVENTS = [
  { id: "dj_friday", name: "Friday Night DJ — DJ Aakash", genre: "Bollywood & EDM", day: "Friday", time: "21:00", cover: 500, desc: "Live DJ set with dance floor" },
  { id: "dj_saturday", name: "Saturday Groove — DJ Nina", genre: "House & Latin", day: "Saturday", time: "22:00", cover: 500, desc: "Premium Saturday nightlife" },
  { id: "dj_jazz", name: "Jazz & Soul Night", genre: "Live Jazz Band", day: "Thursday", time: "20:00", cover: 300, desc: "Live musicians, cocktail pairings" },
  { id: "dj_rooftop", name: "Rooftop Sunset Sessions", genre: "Chill House", day: "Sunday", time: "18:00", cover: 0, desc: "Free entry sundowner vibes" },
];

export const BAR_TABLES = [
  { id: "bar-1", name: "Bar Counter T-1", zone: "Sunset Lounge", capacity: 2 },
  { id: "bar-2", name: "Bar High Table T-2", zone: "Sunset Lounge", capacity: 4 },
  { id: "bar-3", name: "Window Bar T-3", zone: "Sunset Lounge", capacity: 2 },
  { id: "bar-4", name: "Party Booth B-1", zone: "Sunset Lounge", capacity: 6 },
  { id: "bar-5", name: "Dance Floor Edge T-5", zone: "Sunset Lounge", capacity: 4 },
];

export const LOUNGE_ZONES = [
  { id: "vip_lounge", name: "VIP Premium Lounge", capacity: 8, minSpend: 5000, deposit: 2000, features: ["Private booth", "Dedicated server", "Premium spirits", "Bottle service"] },
  { id: "sunset_lounge", name: "Sunset Lounge", capacity: 4, minSpend: 2000, deposit: 500, features: ["City view", "Cocktail menu", "Live music access"] },
  { id: "skybox", name: "Skybox Private", capacity: 12, minSpend: 15000, deposit: 5000, features: ["Exclusive area", "DJ booth view", "Custom playlist", "Champagne welcome"] },
];

export const BAR_TIME_SLOTS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];

export const COCKTAIL_BASES = [
  { id: "rum", label: "White Rum", price: 0 },
  { id: "vodka", label: "Vodka", price: 0 },
  { id: "gin", label: "Gin", price: 0 },
  { id: "tequila", label: "Tequila", price: 0 },
  { id: "whiskey", label: "Whiskey", price: 50 },
  { id: "bourbon", label: "Bourbon", price: 50 },
];

const GARNISH_PRICES: Record<string, number> = {
  mint: 10, lime_wheel: 5, orange_peel: 5, cherry: 10, salt_rim: 0, spicy_rim: 15,
};

const STYLE_MULT: Record<string, number> = { regular: 1, strong: 1.4, light: 0.85 };

export function isHappyHourActive(now = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  return day >= 1 && day <= 5 && mins >= 16 * 60 && mins < 19 * 60;
}

export function cocktailQuote(baseId: string, styleId: string, garnishIds: string[]) {
  const base = COCKTAIL_BASES.find(b => b.id === baseId) ?? COCKTAIL_BASES[0];
  const basePrice = 320 + base.price;
  const garnishTotal = garnishIds.reduce((s, g) => s + (GARNISH_PRICES[g] ?? 0), 0);
  const mult = STYLE_MULT[styleId] ?? 1;
  const price = Math.round((basePrice + garnishTotal) * mult);
  const hh = isHappyHourActive();
  const finalPrice = hh ? Math.round(price * (1 - HAPPY_HOUR.discountPercent / 100)) : price;
  return { basePrice: price, finalPrice, happyHourApplied: hh, discount: hh ? HAPPY_HOUR.discountPercent : 0 };
}

export function getBarCatalog() {
  return {
    happyHour: HAPPY_HOUR,
    djEvents: DJ_EVENTS,
    barTables: BAR_TABLES,
    loungeZones: LOUNGE_ZONES,
    timeSlots: BAR_TIME_SLOTS,
    cocktailBases: COCKTAIL_BASES,
    isHappyHourNow: isHappyHourActive(),
  };
}

export function filterHappyHourItems(items: { name: string; price: string | number; categorySlug?: string; slug?: string }[]) {
  const slugs = new Set(["happy-hour-menu", "cocktails", "beer-menu", "wine-menu", "mocktails"]);
  return items
    .filter(i => slugs.has(i.categorySlug ?? i.slug ?? ""))
    .map(i => {
      const p = parseFloat(String(i.price));
      const discounted = Math.round(p * (1 - HAPPY_HOUR.discountPercent / 100));
      return { ...i, price: p, originalPrice: p, happyHourPrice: discounted };
    });
}
