export type LiveOffer = {
  id: string;
  title: string;
  subtitle: string;
  discountPercent?: number;
  discountAmount?: number;
  badge: string;
  expiresAt: string | null;
  code: string;
  category: string;
};

export type VideoBanner = {
  id: string;
  title: string;
  subtitle: string;
  posterUrl: string;
  videoUrl: string | null;
  cta: string;
  durationSec: number;
};

const DEFAULT_POSTERS = [
  "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  "https://images.unsplash.com/photo-1606312619070-d48cbd4c763f?w=800&q=80",
];

const SPIN_SEGMENTS = [
  { id: "s1", label: "10% Off", value: "10pct", color: "#7c3aed" },
  { id: "s2", label: "Free Drink", value: "free_drink", color: "#f97316" },
  { id: "s3", label: "₹50 Cashback", value: "cash50", color: "#10b981" },
  { id: "s4", label: "Try Again", value: "retry", color: "#64748b" },
  { id: "s5", label: "15% Off", value: "15pct", color: "#ec4899" },
  { id: "s6", label: "Free Dessert", value: "free_dessert", color: "#eab308" },
];

const FESTIVAL_THEMES = [
  { id: "default", label: "Classic", icon: "✨", primary: "#f97316", secondary: "#7c3aed", accent: "#0b1120" },
  { id: "diwali", label: "Diwali", icon: "🪔", primary: "#f59e0b", secondary: "#dc2626", accent: "#1a0a00" },
  { id: "holi", label: "Holi", icon: "🎨", primary: "#ec4899", secondary: "#8b5cf6", accent: "#1e0a2e" },
  { id: "christmas", label: "Christmas", icon: "🎄", primary: "#dc2626", secondary: "#16a34a", accent: "#0a1a0f" },
  { id: "ramadan", label: "Ramadan", icon: "🌙", primary: "#6366f1", secondary: "#fbbf24", accent: "#0f0a1a" },
  { id: "monsoon", label: "Monsoon", icon: "🌧️", primary: "#0891b2", secondary: "#64748b", accent: "#0a1628" },
];

const SEASONAL_ANIMATIONS = [
  { id: "none", label: "Off", icon: "⭕", particles: 0 },
  { id: "snow", label: "Snowfall", icon: "❄️", particles: 40 },
  { id: "petals", label: "Flower Petals", icon: "🌸", particles: 30 },
  { id: "confetti", label: "Confetti", icon: "🎊", particles: 35 },
  { id: "fireflies", label: "Fireflies", icon: "✨", particles: 25 },
  { id: "rain", label: "Monsoon Rain", icon: "🌧️", particles: 50 },
];

const claimedOffers = new Set<string>();
const spinHistory: { guestKey: string; prize: string; at: string }[] = [];

export function getDigitalExperienceCatalog() {
  return {
    features: ["live_offers", "video_banners", "interactive_promotions", "festival_themes", "seasonal_animations"],
    themeCount: FESTIVAL_THEMES.length,
    animationCount: SEASONAL_ANIMATIONS.length - 1,
    spinSegments: SPIN_SEGMENTS.length,
  };
}

export function mapCampaignToOffer(c: {
  id: number; name: string; type: string; description: string | null;
  discountPercent: string | null; discountAmount: string | null;
  endDate: string | null; isActive: boolean;
}): LiveOffer | null {
  if (!c.isActive) return null;
  return {
    id: `campaign-${c.id}`,
    title: c.name,
    subtitle: c.description ?? c.type,
    discountPercent: c.discountPercent ? parseFloat(c.discountPercent) : undefined,
    discountAmount: c.discountAmount ? parseFloat(c.discountAmount) : undefined,
    badge: c.type === "happy_hour" ? "LIVE NOW" : "OFFER",
    expiresAt: c.endDate ? `${c.endDate}T23:59:59Z` : null,
    code: c.name.replace(/\s+/g, "").slice(0, 8).toUpperCase(),
    category: c.type,
  };
}

export function mapSignageToBanners(signageSlides?: {
  type: string; title: string; subtitle?: string; posterUrl?: string; videoUrl?: string | null;
  bg_color?: string; active?: boolean;
}[]): VideoBanner[] {
  if (!signageSlides?.length) return [];
  return signageSlides
    .filter(s => s.active !== false)
    .map((s, i) => ({
      id: `signage-${i}`,
      title: s.title,
      subtitle: s.subtitle ?? "",
      posterUrl: s.posterUrl ?? DEFAULT_POSTERS[i % DEFAULT_POSTERS.length],
      videoUrl: s.videoUrl ?? (s.type === "promo" ? "https://www.w3schools.com/html/mov_bbb.mp4" : null),
      cta: s.type === "menu" ? "View Menu" : "Order Now",
      durationSec: 10,
    }));
}

export function getPromotionsConfig() {
  return {
    spinWheel: { segments: SPIN_SEGMENTS, maxSpinsPerDay: 3 },
    scratchCards: [
      { id: "sc-1", title: "Scratch & Win", hidden: "₹100 OFF" },
      { id: "sc-2", title: "Mystery Reward", hidden: "Free Mocktail" },
      { id: "sc-3", title: "Lucky Dip", hidden: "20% Discount" },
    ],
    tapPromos: [
      { id: "tp-1", emoji: "🍕", title: "Pizza Night", reward: "Buy 1 Get 1" },
      { id: "tp-2", emoji: "🍹", title: "Cocktail Hour", reward: "2nd drink 50% off" },
      { id: "tp-3", emoji: "🎂", title: "Birthday Treat", reward: "Free dessert" },
    ],
  };
}

export function spinWheel(guestKey = "guest") {
  const idx = Math.floor(Math.random() * SPIN_SEGMENTS.length);
  const prize = SPIN_SEGMENTS[idx];
  spinHistory.push({ guestKey, prize: prize.label, at: new Date().toISOString() });
  return {
    segmentIndex: idx,
    prize: prize.label,
    value: prize.value,
    code: prize.value === "retry" ? null : `SPIN-${prize.value.toUpperCase()}`,
    message: prize.value === "retry" ? "Better luck next time!" : `You won: ${prize.label}!`,
  };
}

export function claimOffer(offerId: string, guestKey = "guest") {
  if (claimedOffers.has(`${guestKey}:${offerId}`)) {
    return { success: true, alreadyClaimed: true, message: "Offer already in your wallet" };
  }
  claimedOffers.add(`${guestKey}:${offerId}`);
  return { success: true, alreadyClaimed: false, message: "Offer claimed — apply at checkout" };
}

export function getFestivalThemes() {
  return FESTIVAL_THEMES;
}

export function getSeasonalAnimations() {
  return SEASONAL_ANIMATIONS;
}

export function offerTimeRemaining(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { expired: true, label: "Expired" };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return { expired: false, label: `${h}h ${m}m left`, ms };
  if (m > 0) return { expired: false, label: `${m}m ${s}s left`, ms };
  return { expired: false, label: `${s}s left`, ms };
}
