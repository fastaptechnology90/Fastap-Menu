/** Bar & Nightlife System — catalog */
export const HAPPY_HOUR = {
  label: "Happy Hour",
  icon: "⏰",
  days: "Mon – Fri",
  start: "16:00",
  end: "19:00",
  discountPercent: 20,
  desc: "20% off cocktails, beer & bar bites",
};

export const COCKTAIL_BASES = [
  { id: "rum", label: "White Rum", icon: "🥃", price: 0 },
  { id: "vodka", label: "Vodka", icon: "🍸", price: 0 },
  { id: "gin", label: "Gin", icon: "🌿", price: 0 },
  { id: "tequila", label: "Tequila", icon: "🌵", price: 0 },
  { id: "whiskey", label: "Whiskey", icon: "🥃", price: 50 },
  { id: "bourbon", label: "Bourbon", icon: "🥃", price: 50 },
] as const;

export const COCKTAIL_MIXERS = [
  { id: "soda", label: "Soda Water", price: 0 },
  { id: "tonic", label: "Tonic", price: 0 },
  { id: "cola", label: "Cola", price: 0 },
  { id: "cranberry", label: "Cranberry", price: 20 },
  { id: "pineapple", label: "Pineapple Juice", price: 20 },
  { id: "lime", label: "Fresh Lime", price: 15 },
] as const;

export const COCKTAIL_GARNISHES = [
  { id: "mint", label: "Fresh Mint", price: 10 },
  { id: "lime_wheel", label: "Lime Wheel", price: 5 },
  { id: "orange_peel", label: "Orange Peel", price: 5 },
  { id: "cherry", label: "Maraschino Cherry", price: 10 },
  { id: "salt_rim", label: "Salt Rim", price: 0 },
  { id: "spicy_rim", label: "Spicy Rim", price: 15 },
] as const;

export const COCKTAIL_STYLES = [
  { id: "regular", label: "Regular", multiplier: 1 },
  { id: "strong", label: "Double Shot", multiplier: 1.4 },
  { id: "light", label: "Light", multiplier: 0.85 },
] as const;

export const DJ_EVENTS = [
  { id: "dj_friday", name: "Friday Night DJ — DJ Aakash", genre: "Bollywood & EDM", day: "Friday", time: "21:00", cover: 500, desc: "Live DJ set with dance floor" },
  { id: "dj_saturday", name: "Saturday Groove — DJ Nina", genre: "House & Latin", day: "Saturday", time: "22:00", cover: 500, desc: "Premium Saturday nightlife" },
  { id: "dj_jazz", name: "Jazz & Soul Night", genre: "Live Jazz Band", day: "Thursday", time: "20:00", cover: 300, desc: "Live musicians, cocktail pairings" },
  { id: "dj_rooftop", name: "Rooftop Sunset Sessions", genre: "Chill House", day: "Sunday", time: "18:00", cover: 0, desc: "Free entry sundowner vibes" },
] as const;

export const BAR_TABLES = [
  { id: "bar-1", name: "Bar Counter T-1", zone: "Sunset Lounge", capacity: 2, type: "bar" },
  { id: "bar-2", name: "Bar High Table T-2", zone: "Sunset Lounge", capacity: 4, type: "bar" },
  { id: "bar-3", name: "Window Bar T-3", zone: "Sunset Lounge", capacity: 2, type: "bar" },
  { id: "bar-4", name: "Party Booth B-1", zone: "Sunset Lounge", capacity: 6, type: "bar" },
  { id: "bar-5", name: "Dance Floor Edge T-5", zone: "Sunset Lounge", capacity: 4, type: "bar" },
] as const;

export const LOUNGE_ZONES = [
  { id: "vip_lounge", name: "VIP Premium Lounge", icon: "👑", capacity: 8, minSpend: 5000, deposit: 2000, features: ["Private booth", "Dedicated server", "Premium spirits", "Bottle service"] },
  { id: "sunset_lounge", name: "Sunset Lounge", icon: "🌅", capacity: 4, minSpend: 2000, deposit: 500, features: ["City view", "Cocktail menu", "Live music access"] },
  { id: "skybox", name: "Skybox Private", icon: "✨", capacity: 12, minSpend: 15000, deposit: 5000, features: ["Exclusive area", "DJ booth view", "Custom playlist", "Champagne welcome"] },
] as const;

export const BAR_TIME_SLOTS = ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];

export const DEMO_HAPPY_HOUR_ITEMS = [
  { id: "hh1", name: "HH Chicken Wings", price: 25, originalPrice: 32, category: "happy-hour-menu", desc: "Spicy wings — happy hour special" },
  { id: "hh2", name: "Spice Garden Mojito", price: 28, originalPrice: 35, category: "cocktails", desc: "20% off signature mojito" },
  { id: "hh3", name: "Kingfisher Premium", price: 144, originalPrice: 180, category: "beer-menu", desc: "Domestic beer happy hour" },
  { id: "hh4", name: "Bar Nachos Platter", price: 20, originalPrice: 28, category: "happy-hour-menu", desc: "Loaded nachos to share" },
  { id: "hh5", name: "House Red Wine (Glass)", price: 24, originalPrice: 30, category: "wine-menu", desc: "Wine by the glass" },
];

export function buildCocktailPrice(basePrice: number, styleId: string, garnishes: string[], garnishList: typeof COCKTAIL_GARNISHES) {
  const style = COCKTAIL_STYLES.find(s => s.id === styleId) ?? COCKTAIL_STYLES[0];
  const garnishTotal = garnishes.reduce((s, gId) => s + (garnishList.find(g => g.id === gId)?.price ?? 0), 0);
  return Math.round((basePrice + garnishTotal) * style.multiplier);
}

export function isHappyHourActive(now = new Date()): boolean {
  const h = now.getHours();
  const m = now.getMinutes();
  const mins = h * 60 + m;
  const start = 16 * 60;
  const end = 19 * 60;
  const day = now.getDay();
  return day >= 1 && day <= 5 && mins >= start && mins < end;
}
