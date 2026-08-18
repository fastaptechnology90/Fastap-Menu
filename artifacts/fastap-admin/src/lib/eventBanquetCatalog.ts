/** Event & Banquet System — catalog */
export const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", icon: "💒", desc: "Full wedding celebrations", hallTypes: ["grand_hall", "rooftop", "garden"] },
  { id: "birthday", label: "Birthday", icon: "🎂", desc: "Birthday parties & milestones", hallTypes: ["banquet_b", "rooftop", "pool_deck"] },
  { id: "engagement", label: "Engagement", icon: "💍", desc: "Engagement & ring ceremonies", hallTypes: ["grand_hall", "banquet_b", "garden"] },
  { id: "corporate", label: "Corporate Events", icon: "💼", desc: "Galas, launches & team events", hallTypes: ["conference_a", "conference_b", "grand_hall"] },
  { id: "conference", label: "Conferences", icon: "🎤", desc: "Seminars, summits & workshops", hallTypes: ["conference_a", "conference_b"] },
  { id: "cocktail", label: "Cocktail Parties", icon: "🍸", desc: "Evening cocktail receptions", hallTypes: ["rooftop", "pool_deck", "banquet_b"] },
  { id: "pool_party", label: "Pool Parties", icon: "🏊", desc: "Poolside celebrations", hallTypes: ["pool_deck"] },
  { id: "live_music", label: "Live Music Events", icon: "🎵", desc: "Concerts & live performances", hallTypes: ["rooftop", "grand_hall", "pool_deck"] },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]["id"];

export const EVENT_HALLS = [
  {
    id: "grand_hall", name: "Grand Banquet Hall", capacity: 300, area: "5000 sq ft",
    rate: 25000, image: "🏛️", features: ["Stage", "Dance Floor", "PA System", "LED Lighting", "AC", "Bar Counter"],
    preview: "Spacious hall with crystal chandeliers, stage, and dance floor — ideal for weddings & large galas.",
  },
  {
    id: "conference_a", name: "Conference Hall A", capacity: 150, area: "2500 sq ft",
    rate: 12000, image: "💼", features: ["Projector", "PA System", "AC", "Video Conferencing", "Whiteboard"],
    preview: "Professional conference setup with AV equipment and breakout-friendly layout.",
  },
  {
    id: "conference_b", name: "Conference Hall B", capacity: 200, area: "3000 sq ft",
    rate: 15000, image: "🎤", features: ["Projector", "Stage", "AC", "Breakout Rooms"],
    preview: "Medium conference hall with stage and flexible seating for summits.",
  },
  {
    id: "rooftop", name: "Rooftop Garden", capacity: 100, area: "3500 sq ft",
    rate: 18000, image: "🌃", features: ["Open Air", "Garden Decor", "Fairy Lights", "City View", "Barbeque"],
    preview: "Stunning rooftop with city skyline — perfect for cocktails & live music.",
  },
  {
    id: "banquet_b", name: "Banquet Hall B", capacity: 120, area: "2200 sq ft",
    rate: 18000, image: "🎊", features: ["AC", "Dance Floor", "PA System", "Private Bar"],
    preview: "Intimate banquet hall for birthdays, engagements & mid-size events.",
  },
  {
    id: "pool_deck", name: "Pool Deck", capacity: 60, area: "2000 sq ft",
    rate: 14000, image: "🏊", features: ["Pool View", "Outdoor", "Bar Counter", "Fairy Lights"],
    preview: "Poolside deck for pool parties and sunset cocktail events.",
  },
] as const;

export const SEATING_LAYOUTS = [
  { id: "theatre", label: "Theatre Style", icon: "🪑", capacityFactor: 1, desc: "Rows facing stage — best for conferences & performances", rows: 8, cols: 10 },
  { id: "banquet", label: "Banquet Rounds", icon: "⭕", capacityFactor: 0.7, desc: "Round tables of 8–10 — ideal for weddings & dinners", rows: 6, cols: 5 },
  { id: "cocktail", label: "Cocktail / Standing", icon: "🍸", capacityFactor: 1.2, desc: "High tables, open flow — parties & networking", rows: 4, cols: 8 },
  { id: "u_shape", label: "U-Shape", icon: "🔲", capacityFactor: 0.5, desc: "Boardroom U-shape — corporate meetings", rows: 5, cols: 7 },
  { id: "classroom", label: "Classroom", icon: "📚", capacityFactor: 0.8, desc: "Desks in rows — workshops & training", rows: 6, cols: 8 },
  { id: "poolside", label: "Poolside Lounge", icon: "🏖️", capacityFactor: 0.6, desc: "Loungers & cabanas — pool parties", rows: 3, cols: 6 },
] as const;

export const CATERING_PACKAGES = [
  { id: "basic", label: "Essential", icon: "🍽️", perGuest: 450, desc: "Welcome drink, 2 starters, main course, dessert", items: ["Welcome mocktail", "2 veg/non-veg starters", "Choice of main", "Dessert platter"] },
  { id: "standard", label: "Standard", icon: "🥘", perGuest: 750, desc: "3-course meal with live counters", items: ["Welcome drink", "Soup & salad", "3 starters", "Main + bread", "Dessert bar", "Tea/coffee"] },
  { id: "premium", label: "Premium", icon: "👨‍🍳", perGuest: 1200, desc: "Gourmet multi-course with live stations", items: ["Champagne welcome", "4 starters", "Live pasta & grill", "Premium mains", "Artisan dessert", "Premium bar (2 hrs)"] },
  { id: "royal", label: "Royal Banquet", icon: "👑", perGuest: 1800, desc: "Luxury feast for weddings & galas", items: ["Royal welcome", "6-course tasting menu", "Live chaat & tandoor", "International buffet", "Wedding cake", "Premium bar (4 hrs)", "Midnight snacks"] },
  { id: "cocktail_bites", label: "Cocktail Bites", icon: "🍤", perGuest: 550, desc: "Canapés & finger food for standing events", items: ["12 canapé varieties", "Live sushi station", "Mini desserts", "Signature cocktails"] },
  { id: "pool_bbq", label: "Pool BBQ", icon: "🔥", perGuest: 650, desc: "Grill & poolside dining", items: ["BBQ grill live", "Salads & sides", "Fresh seafood", "Tropical drinks", "Ice cream bar"] },
] as const;

export const DECORATION_PACKAGES = [
  { id: "minimal", label: "Minimal Elegance", icon: "✨", price: 8000, desc: "Fresh florals, table linens, basic lighting" },
  { id: "floral", label: "Floral Theme", icon: "💐", price: 18000, desc: "Stage backdrop, floral arches, centrepieces" },
  { id: "theme", label: "Theme Decor", icon: "🎨", price: 25000, desc: "Custom theme setup — birthday, engagement, etc." },
  { id: "wedding", label: "Wedding Grand", icon: "💒", price: 45000, desc: "Mandap/stage, aisle decor, full venue transformation" },
  { id: "corporate", label: "Corporate Branding", icon: "🏢", price: 12000, desc: "Branded backdrop, signage, stage branding" },
  { id: "pool_party", label: "Pool Party Vibes", icon: "🌴", price: 15000, desc: "Tropical decor, inflatables, fairy lights, photo zone" },
  { id: "live_music", label: "Concert Setup", icon: "🎸", price: 22000, desc: "Stage lighting, truss, LED wall, sound aesthetics" },
] as const;

export function hallsForEventType(typeId: string) {
  const t = EVENT_TYPES.find(e => e.id === typeId);
  if (!t) return EVENT_HALLS;
  return EVENT_HALLS.filter(h => t.hallTypes.includes(h.id as never));
}

export function recommendedDecor(typeId: string) {
  const map: Record<string, string[]> = {
    wedding: ["wedding", "floral", "theme"],
    birthday: ["theme", "floral", "minimal"],
    engagement: ["floral", "theme", "wedding"],
    corporate: ["corporate", "minimal", "theme"],
    conference: ["corporate", "minimal"],
    cocktail: ["minimal", "theme", "floral"],
    pool_party: ["pool_party", "theme"],
    live_music: ["live_music", "theme", "minimal"],
  };
  const ids = map[typeId] ?? ["minimal", "floral"];
  return DECORATION_PACKAGES.filter(d => ids.includes(d.id));
}

export interface QuotationLine {
  label: string;
  amount: number;
}

export interface EventQuotation {
  lines: QuotationLine[];
  subtotal: number;
  tax: number;
  total: number;
  advance: number;
}

export function computeQuotation(
  hallRate: number,
  guestCount: number,
  cateringPerGuest: number,
  decorPrice: number,
): EventQuotation {
  const cateringTotal = guestCount * cateringPerGuest;
  const lines: QuotationLine[] = [
    { label: "Venue hire", amount: hallRate },
    { label: `Catering (${guestCount} guests)`, amount: cateringTotal },
    { label: "Decoration package", amount: decorPrice },
    { label: "Service & setup", amount: Math.round(hallRate * 0.08) },
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  const advance = Math.round(total * 0.3);
  return { lines, subtotal, tax, total, advance };
}

export interface GuestInvitation {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: "pending" | "sent" | "accepted" | "declined";
}
