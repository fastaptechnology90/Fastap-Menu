/** Smart Kiosk & Self Ordering — catalog & demo data */

export type KioskFeatureId =
  | "self_ordering"
  | "self_checkout"
  | "nfc_tap_ordering"
  | "qr_self_payment"
  | "token_display";

export const KIOSK_FEATURES = [
  { id: "self_ordering" as const, label: "Self Ordering", icon: "🖥️", desc: "Touch to browse menu & build your order — no waiter needed" },
  { id: "self_checkout" as const, label: "Self Checkout", icon: "✅", desc: "Review bill, apply tips & pay — complete checkout independently" },
  { id: "nfc_tap_ordering" as const, label: "NFC Tap Ordering", icon: "📶", desc: "Tap NFC tag or phone to add items or pay contactlessly" },
  { id: "qr_self_payment" as const, label: "QR Self Payment", icon: "🔲", desc: "Scan restaurant QR with UPI app to pay instantly" },
  { id: "token_display" as const, label: "Token Display", icon: "🎫", desc: "Get pickup token — track order on display board" },
];

export const KIOSK_PAYMENT_MODES = [
  { id: "upi", label: "UPI", icon: "📱" },
  { id: "card", label: "Card", icon: "💳" },
  { id: "nfc", label: "NFC Tap", icon: "📶" },
  { id: "qr", label: "QR Scan", icon: "🔲" },
  { id: "wallet", label: "Wallet", icon: "👛" },
  { id: "cash", label: "Cash at Counter", icon: "💵" },
];

export const DEMO_KIOSK_MENU = [
  { id: 101, name: "Chicken Tikka", price: 45, category: "Starters", spice: 2, veg: false },
  { id: 103, name: "Butter Chicken", price: 65, category: "Main Course", spice: 1, veg: false },
  { id: 104, name: "Paneer Tikka", price: 42, category: "Starters", spice: 1, veg: true },
  { id: 108, name: "Masala Dosa", price: 35, category: "Breakfast", spice: 0, veg: true },
  { id: 105, name: "Gulab Jamun", price: 22, category: "Desserts", spice: 0, veg: true },
  { id: 110, name: "Masala Chai", price: 15, category: "Beverages", spice: 0, veg: true },
];

export const DEMO_NFC_TAGS = [
  { id: "nfc-starter", label: "Starter Combo NFC", item: "Chicken Tikka", price: 45, menuItemId: 101 },
  { id: "nfc-main", label: "Today's Special NFC", item: "Butter Chicken", price: 65, menuItemId: 103 },
  { id: "nfc-pay", label: "NFC Pay Terminal", item: "Quick Pay", price: 0, menuItemId: 0 },
];

export const DEMO_QR_PAYMENT = {
  upiId: "spicegarden@upi",
  merchantName: "Spice Garden",
  qrPayload: "upi://pay?pa=spicegarden@upi&pn=Spice%20Garden&cu=INR",
};

export const DEMO_TOKEN_BOARD = [
  { token: "K-041", status: "ready", order: "Butter Chicken + Naan" },
  { token: "K-042", status: "preparing", order: "Paneer Tikka x2" },
  { token: "K-043", status: "queued", order: "Masala Dosa" },
];

export const KIOSK_CONFIG_DEFAULT = {
  enabled: true,
  welcomeMessage: "Welcome! Touch to Start Ordering",
  themeColor: "#7c3aed",
  idleTimeoutSec: 60,
  nfcEnabled: true,
  qrEnabled: true,
  tokenPrefix: "K",
  showCalories: true,
  showAllergens: true,
};

export type KioskCartItem = {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
};

export type KioskToken = {
  tokenNumber: string;
  orderId?: number;
  status: "queued" | "preparing" | "ready" | "collected";
  items: KioskCartItem[];
  total: number;
  paymentMethod: string;
  createdAt: string;
  estimatedMinutes: number;
};
