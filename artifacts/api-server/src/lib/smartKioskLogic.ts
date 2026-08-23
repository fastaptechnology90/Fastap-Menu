export type KioskCartItem = {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
};

const DEFAULT_CONFIG = {
  enabled: true,
  welcomeMessage: "Welcome! Touch to Start Ordering",
  themeColor: "#7c3aed",
  idleTimeoutSec: 60,
  nfcEnabled: true,
  qrEnabled: true,
  tokenPrefix: "K",
  showCalories: true,
  showAllergens: true,
  paymentModes: ["upi", "card", "nfc", "qr", "wallet", "cash"],
};

const NFC_TAGS = [
  { id: "nfc-starter", label: "Starter Tap", item: "Chicken Tikka", price: 45, menuItemId: 101 },
  { id: "nfc-main", label: "Main Tap", item: "Butter Chicken", price: 65, menuItemId: 103 },
  { id: "nfc-pay", label: "Quick Pay", item: "Quick Pay", price: 0, menuItemId: 0 },
];

// Exposed to the kiosk config so the guest NFC tab can show the quick-tap shortcuts.
export function getNfcTags() {
  return NFC_TAGS.map(t => ({ id: t.id, label: t.label, item: t.item, price: t.price, menuItemId: t.menuItemId }));
}

let tokenCounter = 40;

export function getKioskCatalog() {
  return {
    features: ["self_ordering", "self_checkout", "nfc_tap_ordering", "qr_self_payment", "token_display"],
    paymentModes: DEFAULT_CONFIG.paymentModes,
    nfcEnabled: true,
    qrEnabled: true,
  };
}

export function getKioskConfig(settings?: Record<string, unknown>) {
  return { ...DEFAULT_CONFIG, ...settings };
}

export function generateTokenNumber(prefix = "K"): string {
  tokenCounter += 1;
  return `${prefix}-${String(tokenCounter).padStart(3, "0")}`;
}

export function buildKioskBill(items: KioskCartItem[], tip = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * 0.05 * 100) / 100;
  const grandTotal = Math.round((taxable + gst + tip) * 100) / 100;
  return { subtotal, discount, gst, tip, grandTotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
}

export function buildQrPaymentPayload(upiId: string, merchantName: string, amount: number) {
  const pn = encodeURIComponent(merchantName);
  const am = amount > 0 ? `&am=${amount.toFixed(2)}` : "";
  const payload = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&cu=INR${am}`;
  return {
    upiId,
    merchantName,
    amount,
    qrPayload: payload,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`,
  };
}

export function processNfcTap(tagId: string, cart: KioskCartItem[]) {
  const tag = NFC_TAGS.find(t => t.id === tagId);
  if (!tag) return { action: "add_item" as const, cart, message: "Unknown NFC tag" };
  if (tagId.includes("pay") || tag.price === 0) {
    return { action: "pay" as const, cart, message: "NFC payment initiated" };
  }
  const existing = cart.find(c => c.name === tag.item);
  const next = existing
    ? cart.map(c => c.name === tag.item ? { ...c, quantity: c.quantity + 1 } : c)
    : [...cart, { menuItemId: tag.menuItemId, name: tag.item, price: tag.price, quantity: 1 }];
  return { action: "add_item" as const, cart: next, message: `${tag.item} added via NFC tap` };
}

export function tokenStatusLabel(status: string) {
  const map: Record<string, string> = {
    queued: "In Queue",
    preparing: "Preparing",
    ready: "Ready — Collect Now!",
    collected: "Collected",
  };
  return map[status] ?? status;
}
