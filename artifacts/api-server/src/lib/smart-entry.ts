export const ACCESS_METHODS = [
  "qr",
  "nfc",
  "browser",
  "direct_url",
  "pwa",
  "room_qr",
  "poolside_qr",
  "spa_qr",
  "event_qr",
  "parking_qr",
] as const;

export type AccessMethod = (typeof ACCESS_METHODS)[number];

export const ZONE_CATALOG = {
  indoor_dining: {
    label: "Indoor Dining Area",
    zones: [
      { slug: "ac_section", name: "AC Section", areaType: "indoor" },
      { slug: "premium_indoor", name: "Premium Indoor", areaType: "indoor" },
      { slug: "family_section", name: "Family Section", areaType: "indoor" },
      { slug: "fine_dine", name: "Fine Dine Section", areaType: "indoor" },
      { slug: "fast_dining", name: "Fast Dining Section", areaType: "indoor" },
      { slug: "silent_zone", name: "Silent Dining Zone", areaType: "indoor" },
      { slug: "kids_friendly", name: "Kids Friendly Zone", areaType: "indoor" },
    ],
  },
  outdoor_dining: {
    label: "Outdoor Dining Area",
    zones: [
      { slug: "garden_seating", name: "Garden Seating", areaType: "outdoor" },
      { slug: "rooftop_seating", name: "Rooftop Seating", areaType: "outdoor" },
      { slug: "balcony_seating", name: "Balcony Seating", areaType: "outdoor" },
      { slug: "poolside_seating", name: "Poolside Seating", areaType: "outdoor" },
      { slug: "beachside_seating", name: "Beachside Seating", areaType: "outdoor" },
      { slug: "open_terrace", name: "Open Terrace Seating", areaType: "outdoor" },
      { slug: "smoking_zone", name: "Smoking Zone", areaType: "outdoor" },
      { slug: "sunset_lounge", name: "Sunset Lounge", areaType: "outdoor" },
    ],
  },
  special_experience: {
    label: "Special Experience Zones",
    zones: [
      { slug: "vip_lounge", name: "VIP Lounge", areaType: "vip" },
      { slug: "private_cabin", name: "Private Cabin", areaType: "vip" },
      { slug: "couple_cabin", name: "Couple Cabin", areaType: "vip" },
      { slug: "corporate_dining", name: "Corporate Dining Area", areaType: "special" },
      { slug: "banquet_section", name: "Banquet Section", areaType: "special" },
      { slug: "conference_dining", name: "Conference Dining Area", areaType: "special" },
      { slug: "party_zone", name: "Party Zone", areaType: "special" },
      { slug: "live_music", name: "Live Music Zone", areaType: "special" },
    ],
  },
} as const;

export interface EntryQuery {
  table?: string;
  room?: string;
  section?: string;
  branch?: string;
  lang?: string;
  entry?: string;
  via?: string;
  access?: string;
  nfc?: string;
  pool?: string;
  spa?: string;
  event?: string;
  eventId?: string;
  parking?: string;
  zone?: string;
  share?: string;
  session?: string;
}

export function detectAccessMethod(q: EntryQuery, headers: Record<string, string | string[] | undefined>): AccessMethod {
  const entry = (q.entry || q.via || q.access || "").toLowerCase();
  if (entry === "nfc" || q.nfc === "1" || q.nfc === "true") return "nfc";
  if (entry === "pwa" || headers["sec-fetch-mode"] === "navigate" && headers["sec-fetch-dest"] === "webapp") return "pwa";
  if (q.room) return "room_qr";
  if (q.pool === "1" || q.pool === "true" || q.zone === "poolside" || entry === "poolside") return "poolside_qr";
  if (q.spa === "1" || q.spa === "true" || entry === "spa") return "spa_qr";
  if (q.event === "1" || q.eventId || entry === "event") return "event_qr";
  if (q.parking === "1" || q.parking === "true" || entry === "parking") return "parking_qr";
  if (q.table) return "qr";
  if (entry === "browser") return "browser";
  if (entry === "direct" || entry === "url") return "direct_url";
  const ua = String(headers["user-agent"] ?? "").toLowerCase();
  if (ua.includes("wv") || ua.includes("mobile")) return "browser";
  return "direct_url";
}

export function detectServiceMode(q: EntryQuery, accessMethod: AccessMethod): string {
  if (q.room) return "room_service";
  if (accessMethod === "poolside_qr" || q.zone === "poolside") return "poolside";
  if (accessMethod === "spa_qr") return "spa";
  if (accessMethod === "event_qr") return "event";
  if (accessMethod === "parking_qr") return "parking_valet";
  const entry = (q.entry || q.via || "").toLowerCase();
  if (entry === "drive-through" || q.zone === "drive_through") return "drive_through";
  if (entry === "drive-in" || q.zone === "drive_in") return "drive_in";
  if (entry === "bar" || q.zone === "bar") return "bar";
  if (entry === "lounge" || q.zone === "lounge" || q.zone === "vip_lounge") return "lounge";
  if (entry === "cabana" || q.zone === "cabana") return "cabana";
  if (entry === "takeaway") return "takeaway";
  if (q.table) return "dine_in";
  return "browse";
}

export function detectLanguage(q: EntryQuery, acceptLanguage?: string): string {
  if (q.lang) return q.lang.slice(0, 5);
  const header = acceptLanguage?.split(",")[0]?.trim();
  if (header) return header.slice(0, 5);
  return "en";
}

export function detectTimezone(restaurantTz?: string | null): string {
  return restaurantTz || "Asia/Kolkata";
}

export function groupAreasByCategory(areas: { name: string; areaType: string; layoutConfig?: unknown }[]) {
  const grouped: Record<string, typeof areas> = {
    indoor_dining: [],
    outdoor_dining: [],
    special_experience: [],
  };

  for (const area of areas) {
    const cfg = (area.layoutConfig ?? {}) as { zoneCategory?: string };
    const category = cfg.zoneCategory
      ?? (area.areaType === "outdoor" ? "outdoor_dining"
        : area.areaType === "vip" || area.areaType === "special" ? "special_experience"
          : "indoor_dining");
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(area);
  }

  return Object.entries(ZONE_CATALOG).map(([key, meta]) => ({
    category: key,
    label: meta.label,
    areas: grouped[key] ?? [],
    zoneDefinitions: meta.zones,
  }));
}

export function generateShareCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function generateSessionToken(): string {
  return `gs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}`;
}
