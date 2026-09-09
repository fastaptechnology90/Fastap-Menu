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

/**
 * Halls, catering and decoration used to live here as six invented rooms with rates
 * (25,000 for a "Grand Banquet Hall"), six catering packages and seven decoration
 * packages, and the guest page fell back to them for any venue that had published none —
 * so every venue appeared to own the same six rooms. They now come only from
 * GET /public/events/catalog/:restaurantId, which returns the venue own spaces or an
 * empty list with a notice. Event types and seating layouts stay: they are industry
 * vocabulary, not a claim about a particular venue.
 */
export const SEATING_LAYOUTS = [
  { id: "theatre", label: "Theatre Style", icon: "🪑", capacityFactor: 1, desc: "Rows facing stage — best for conferences & performances", rows: 8, cols: 10 },
  { id: "banquet", label: "Banquet Rounds", icon: "⭕", capacityFactor: 0.7, desc: "Round tables of 8–10 — ideal for weddings & dinners", rows: 6, cols: 5 },
  { id: "cocktail", label: "Cocktail / Standing", icon: "🍸", capacityFactor: 1.2, desc: "High tables, open flow — parties & networking", rows: 4, cols: 8 },
  { id: "u_shape", label: "U-Shape", icon: "🔲", capacityFactor: 0.5, desc: "Boardroom U-shape — corporate meetings", rows: 5, cols: 7 },
  { id: "classroom", label: "Classroom", icon: "📚", capacityFactor: 0.8, desc: "Desks in rows — workshops & training", rows: 6, cols: 8 },
  { id: "poolside", label: "Poolside Lounge", icon: "🏖️", capacityFactor: 0.6, desc: "Loungers & cabanas — pool parties", rows: 3, cols: 6 },
] as const;

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

export interface GuestInvitation {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: "pending" | "sent" | "accepted" | "declined";
}
