/** Digital Experience System — catalog & demo data */

export type DigitalFeatureId =
  | "live_offers"
  | "video_banners"
  | "interactive_promotions"
  | "festival_themes"
  | "seasonal_animations";

export const DIGITAL_FEATURES = [
  { id: "live_offers" as const, label: "Live Offers", icon: "🔥", desc: "Real-time deals, flash sales & limited-time discounts" },
  { id: "video_banners" as const, label: "Video Banners", icon: "🎬", desc: "Auto-playing promo videos & hero banner carousel" },
  { id: "interactive_promotions" as const, label: "Interactive Promotions", icon: "🎡", desc: "Spin wheel, scratch cards & tap-to-reveal rewards" },
  { id: "festival_themes" as const, label: "Festival Themes", icon: "🎉", desc: "Diwali, Holi, Christmas & seasonal UI themes" },
  { id: "seasonal_animations" as const, label: "Seasonal Animations", icon: "❄️", desc: "Snow, petals, confetti & ambient motion effects" },
];

export const DEMO_LIVE_OFFERS = [
  { id: "offer-1", title: "Happy Hour Live", subtitle: "20% off all beverages", discountPercent: 20, badge: "LIVE NOW", expiresAt: new Date(Date.now() + 2 * 3600000).toISOString(), code: "HAPPY20", category: "drinks" },
  { id: "offer-2", title: "Lunch Combo Flash", subtitle: "Main + drink @ ₹299", discountAmount: 50, badge: "FLASH", expiresAt: new Date(Date.now() + 45 * 60000).toISOString(), code: "LUNCH299", category: "combo" },
  { id: "offer-3", title: "Weekend Family Feast", subtitle: "15% off orders above ₹999", discountPercent: 15, badge: "WEEKEND", expiresAt: new Date(Date.now() + 86400000).toISOString(), code: "FAMILY15", category: "family" },
  { id: "offer-4", title: "First Order Welcome", subtitle: "10% off for new guests", discountPercent: 10, badge: "NEW", expiresAt: null, code: "WELCOME10", category: "welcome" },
];

export const DEMO_VIDEO_BANNERS = [
  {
    id: "vb-1",
    title: "Chef's Special Tonight",
    subtitle: "Butter Chicken & Naan combo",
    posterUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    cta: "Order Now",
    durationSec: 15,
  },
  {
    id: "vb-2",
    title: "Weekend Brunch",
    subtitle: "Unlimited starters · 11 AM – 3 PM",
    posterUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    videoUrl: null,
    cta: "View Menu",
    durationSec: 10,
  },
  {
    id: "vb-3",
    title: "Festival Sweets Platter",
    subtitle: "Limited Diwali edition",
    posterUrl: "https://images.unsplash.com/photo-1606312619070-d48cbd4c763f?w=800&q=80",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    cta: "Try Now",
    durationSec: 12,
  },
];

export const SPIN_WHEEL_SEGMENTS = [
  { id: "s1", label: "10% Off", value: "10pct", color: "#7c3aed" },
  { id: "s2", label: "Free Drink", value: "free_drink", color: "#f97316" },
  { id: "s3", label: "₹50 Cashback", value: "cash50", color: "#10b981" },
  { id: "s4", label: "Try Again", value: "retry", color: "#64748b" },
  { id: "s5", label: "15% Off", value: "15pct", color: "#ec4899" },
  { id: "s6", label: "Free Dessert", value: "free_dessert", color: "#eab308" },
];

export const DEMO_SCRATCH_PROMOS = [
  { id: "sc-1", title: "Scratch & Win", hidden: "₹100 OFF", revealed: false },
  { id: "sc-2", title: "Mystery Reward", hidden: "Free Mocktail", revealed: false },
  { id: "sc-3", title: "Lucky Dip", hidden: "20% Discount", revealed: false },
];

export const FESTIVAL_THEMES = [
  { id: "default", label: "Classic", icon: "✨", primary: "#f97316", secondary: "#7c3aed", accent: "#0b1120", gradient: "from-orange-600/20 to-violet-600/20" },
  { id: "diwali", label: "Diwali", icon: "🪔", primary: "#f59e0b", secondary: "#dc2626", accent: "#1a0a00", gradient: "from-amber-500/30 to-orange-700/20" },
  { id: "holi", label: "Holi", icon: "🎨", primary: "#ec4899", secondary: "#8b5cf6", accent: "#1e0a2e", gradient: "from-pink-500/30 to-violet-500/20" },
  { id: "christmas", label: "Christmas", icon: "🎄", primary: "#dc2626", secondary: "#16a34a", accent: "#0a1a0f", gradient: "from-red-600/25 to-green-600/20" },
  { id: "ramadan", label: "Ramadan", icon: "🌙", primary: "#6366f1", secondary: "#fbbf24", accent: "#0f0a1a", gradient: "from-indigo-600/25 to-amber-500/15" },
  { id: "monsoon", label: "Monsoon", icon: "🌧️", primary: "#0891b2", secondary: "#64748b", accent: "#0a1628", gradient: "from-cyan-600/25 to-slate-600/20" },
];

export const SEASONAL_ANIMATIONS = [
  { id: "none", label: "Off", icon: "⭕", particles: 0 },
  { id: "snow", label: "Snowfall", icon: "❄️", particles: 40 },
  { id: "petals", label: "Flower Petals", icon: "🌸", particles: 30 },
  { id: "confetti", label: "Confetti", icon: "🎊", particles: 35 },
  { id: "fireflies", label: "Fireflies", icon: "✨", particles: 25 },
  { id: "rain", label: "Monsoon Rain", icon: "🌧️", particles: 50 },
];

export type LiveOffer = typeof DEMO_LIVE_OFFERS[number];
export type VideoBanner = typeof DEMO_VIDEO_BANNERS[number];
export type FestivalThemeId = typeof FESTIVAL_THEMES[number]["id"];
export type SeasonalAnimationId = typeof SEASONAL_ANIMATIONS[number]["id"];

export const DIGITAL_PREFS_KEY = "fastap_digital_experience";
