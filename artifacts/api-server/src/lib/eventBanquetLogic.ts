export const HALLS = [
  { id: "grand_hall", name: "Grand Banquet Hall", capacity: 300, area: "5000 sq ft", rate: 25000, image: "🏛️", features: ["Stage", "Dance Floor", "PA System", "LED Lighting", "AC", "Bar Counter"], preview: "Spacious hall with crystal chandeliers, stage, and dance floor — ideal for weddings & large galas." },
  { id: "conference_a", name: "Conference Hall A", capacity: 150, area: "2500 sq ft", rate: 12000, image: "💼", features: ["Projector", "PA System", "AC", "Video Conferencing", "Whiteboard"], preview: "Professional conference setup with AV equipment and breakout-friendly layout." },
  { id: "conference_b", name: "Conference Hall B", capacity: 200, area: "3000 sq ft", rate: 15000, image: "🎤", features: ["Projector", "Stage", "AC", "Breakout Rooms"], preview: "Medium conference hall with stage and flexible seating for summits." },
  { id: "rooftop", name: "Rooftop Garden", capacity: 100, area: "3500 sq ft", rate: 18000, image: "🌃", features: ["Open Air", "Garden Decor", "Fairy Lights", "City View", "Barbeque"], preview: "Stunning rooftop with city skyline — perfect for cocktails & live music." },
  { id: "banquet_b", name: "Banquet Hall B", capacity: 120, area: "2200 sq ft", rate: 18000, image: "🎊", features: ["AC", "Dance Floor", "PA System", "Private Bar"], preview: "Intimate banquet hall for birthdays, engagements & mid-size events." },
  { id: "pool_deck", name: "Pool Deck", capacity: 60, area: "2000 sq ft", rate: 14000, image: "🏊", features: ["Pool View", "Outdoor", "Bar Counter", "Fairy Lights"], preview: "Poolside deck for pool parties and sunset cocktail events." },
];

export const CATERING = [
  { id: "basic", label: "Essential", icon: "🍽️", perGuest: 450, desc: "Welcome drink, 2 starters, main course, dessert", items: ["Welcome mocktail", "2 starters", "Main course", "Dessert platter"] },
  { id: "standard", label: "Standard", icon: "🥘", perGuest: 750, desc: "3-course meal with live counters", items: ["Welcome drink", "Soup & salad", "3 starters", "Main + bread", "Dessert bar"] },
  { id: "premium", label: "Premium", icon: "👨‍🍳", perGuest: 1200, desc: "Gourmet multi-course with live stations", items: ["Champagne welcome", "4 starters", "Live pasta & grill", "Premium mains", "Premium bar 2hrs"] },
  { id: "royal", label: "Royal Banquet", icon: "👑", perGuest: 1800, desc: "Luxury feast for weddings & galas", items: ["Royal welcome", "6-course menu", "Live tandoor", "Premium bar 4hrs"] },
  { id: "cocktail_bites", label: "Cocktail Bites", icon: "🍤", perGuest: 550, desc: "Canapés & finger food", items: ["12 canapé varieties", "Live sushi", "Signature cocktails"] },
  { id: "pool_bbq", label: "Pool BBQ", icon: "🔥", perGuest: 650, desc: "Grill & poolside dining", items: ["BBQ grill live", "Seafood", "Tropical drinks"] },
];

export const DECOR = [
  { id: "minimal", label: "Minimal Elegance", icon: "✨", price: 8000, desc: "Fresh florals, table linens, basic lighting" },
  { id: "floral", label: "Floral Theme", icon: "💐", price: 18000, desc: "Stage backdrop, floral arches, centrepieces" },
  { id: "theme", label: "Theme Decor", icon: "🎨", price: 25000, desc: "Custom theme setup" },
  { id: "wedding", label: "Wedding Grand", icon: "💒", price: 45000, desc: "Full venue transformation" },
  { id: "corporate", label: "Corporate Branding", icon: "🏢", price: 12000, desc: "Branded backdrop & signage" },
  { id: "pool_party", label: "Pool Party Vibes", icon: "🌴", price: 15000, desc: "Tropical decor & photo zone" },
  { id: "live_music", label: "Concert Setup", icon: "🎸", price: 22000, desc: "Stage lighting & LED wall" },
];

export const LAYOUTS = [
  { id: "theatre", label: "Theatre Style", icon: "🪑", desc: "Rows facing stage", rows: 8, cols: 10 },
  { id: "banquet", label: "Banquet Rounds", icon: "⭕", desc: "Round tables of 8–10", rows: 6, cols: 5 },
  { id: "cocktail", label: "Cocktail / Standing", icon: "🍸", desc: "High tables, open flow", rows: 4, cols: 8 },
  { id: "u_shape", label: "U-Shape", icon: "🔲", desc: "Boardroom U-shape", rows: 5, cols: 7 },
  { id: "classroom", label: "Classroom", icon: "📚", desc: "Desks in rows", rows: 6, cols: 8 },
  { id: "poolside", label: "Poolside Lounge", icon: "🏖️", desc: "Loungers & cabanas", rows: 3, cols: 6 },
];

export const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", icon: "💒", hallTypes: ["grand_hall", "rooftop", "banquet_b"] },
  { id: "birthday", label: "Birthday", icon: "🎂", hallTypes: ["banquet_b", "rooftop", "pool_deck"] },
  { id: "engagement", label: "Engagement", icon: "💍", hallTypes: ["grand_hall", "banquet_b", "rooftop"] },
  { id: "corporate", label: "Corporate Events", icon: "💼", hallTypes: ["conference_a", "conference_b", "grand_hall"] },
  { id: "conference", label: "Conferences", icon: "🎤", hallTypes: ["conference_a", "conference_b"] },
  { id: "cocktail", label: "Cocktail Parties", icon: "🍸", hallTypes: ["rooftop", "pool_deck", "banquet_b"] },
  { id: "pool_party", label: "Pool Parties", icon: "🏊", hallTypes: ["pool_deck"] },
  { id: "live_music", label: "Live Music Events", icon: "🎵", hallTypes: ["rooftop", "grand_hall", "pool_deck"] },
];

export function buildQuotation(hallId: string, guestCount: number, cateringId: string, decorId: string) {
  const hall = HALLS.find(h => h.id === hallId) ?? HALLS[0];
  const catering = CATERING.find(c => c.id === cateringId) ?? CATERING[1];
  const decor = DECOR.find(d => d.id === decorId) ?? DECOR[0];
  const cateringTotal = guestCount * catering.perGuest;
  const lines = [
    { label: "Venue hire", amount: hall.rate },
    { label: `Catering (${guestCount} guests × ₹${catering.perGuest})`, amount: cateringTotal },
    { label: "Decoration package", amount: decor.price },
    { label: "Service & setup", amount: Math.round(hall.rate * 0.08) },
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  const advance = Math.round(total * 0.3);
  return { lines, subtotal, tax, total, advance, hall: hall.name, catering: catering.label, decor: decor.label };
}

export function getCatalog(eventType?: string, overrides?: {
  halls?: typeof HALLS;
  cateringPackages?: typeof CATERING;
  decorationPackages?: typeof DECOR;
  seatingLayouts?: typeof LAYOUTS;
  eventTypes?: typeof EVENT_TYPES;
}) {
  const hallList = overrides?.halls ?? HALLS;
  const halls = eventType
    ? hallList.filter(h => (overrides?.eventTypes ?? EVENT_TYPES).find(t => t.id === eventType)?.hallTypes.includes(h.id))
    : hallList;
  return {
    eventTypes: overrides?.eventTypes ?? EVENT_TYPES,
    halls,
    seatingLayouts: overrides?.seatingLayouts ?? LAYOUTS,
    cateringPackages: overrides?.cateringPackages ?? CATERING,
    decorationPackages: overrides?.decorationPackages ?? DECOR,
  };
}
