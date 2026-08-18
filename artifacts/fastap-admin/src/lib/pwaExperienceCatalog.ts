/** PWA & App-Like Experience — catalog & demo data */

export type PwaFeatureId =
  | "install_app"
  | "push_notifications"
  | "offline_support"
  | "home_shortcuts"
  | "fast_loading";

export const PWA_FEATURES = [
  { id: "install_app" as const, label: "Install as App", icon: "📲", desc: "Add FastMenu to home screen — works like a native app" },
  { id: "push_notifications" as const, label: "Push Notifications", icon: "🔔", desc: "Order ready, waitlist called & offer alerts" },
  { id: "offline_support" as const, label: "Offline Support", icon: "📴", desc: "Browse cached menu & queue orders without internet" },
  { id: "home_shortcuts" as const, label: "Home Screen Shortcuts", icon: "⚡", desc: "Quick-launch menu, cart, wallet & room service" },
  { id: "fast_loading" as const, label: "Fast Loading", icon: "🚀", desc: "Precached shell · loads in under 2 seconds" },
];

export const HOME_SCREEN_SHORTCUTS = [
  { id: "menu", name: "Order Menu", url: "/user/menu?slug=spice-garden&table=T-12", icon: "🍽️", desc: "Browse & order" },
  { id: "cart", name: "My Cart", url: "/user/cart", icon: "🛒", desc: "View cart & checkout" },
  { id: "track", name: "Track Order", url: "/user/menu?slug=spice-garden&table=T-12", icon: "📍", desc: "Live order status" },
  { id: "wallet", name: "Wallet", url: "/user/wallet", icon: "💳", desc: "Balance & recharge" },
  { id: "room", name: "Room Service", url: "/user/hotel?slug=spice-garden&room=501", icon: "🏨", desc: "Hotel guest hub" },
  { id: "bar", name: "Bar & Lounge", url: "/user/bar?slug=spice-garden", icon: "🍸", desc: "Happy hour & cocktails" },
  { id: "support", name: "Live Support", url: "/user/support?slug=spice-garden", icon: "💬", desc: "Chat & help" },
  { id: "loyalty", name: "Loyalty", url: "/user/loyalty", icon: "⭐", desc: "Points & rewards" },
];

export const PUSH_NOTIFICATION_TYPES = [
  { id: "order_ready", label: "Order Ready", icon: "✅", sample: "Your Butter Chicken is ready at table T-12!" },
  { id: "order_preparing", label: "Kitchen Update", icon: "👨‍🍳", sample: "Chef started preparing your order" },
  { id: "waitlist_called", label: "Waitlist Called", icon: "🔔", sample: "Your table is ready — Token #42" },
  { id: "offer", label: "Offers & Deals", icon: "🎉", sample: "20% off happy hour — today 3–6 PM" },
  { id: "loyalty", label: "Loyalty Rewards", icon: "⭐", sample: "You earned 50 points on your last visit!" },
];

export const DEMO_PWA_STATUS = {
  installed: false,
  standalone: false,
  pushEnabled: false,
  swRegistered: false,
  cacheSize: "2.4 MB",
  loadTimeMs: 840,
  shortcutsAvailable: 8,
};

export const PUSH_PREFS_KEY = "fastap_push_prefs";
export const PWA_INSTALL_DISMISSED_KEY = "fastap_pwa_install_dismissed";

export type PushPrefs = {
  enabled: boolean;
  orderReady: boolean;
  waitlist: boolean;
  offers: boolean;
  loyalty: boolean;
};

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  enabled: false,
  orderReady: true,
  waitlist: true,
  offers: true,
  loyalty: false,
};
