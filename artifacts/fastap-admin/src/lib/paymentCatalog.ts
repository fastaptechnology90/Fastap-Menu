/** Payment System — catalog & helpers */
export type PaymentModeId = "upi" | "card" | "cash" | "nfc" | "qr" | "wallet" | "netbanking";

export const PAYMENT_MODES = [
  { id: "upi" as const, label: "UPI", icon: "📱", desc: "PhonePe, GPay, Paytm, BHIM", instant: true },
  { id: "card" as const, label: "Card", icon: "💳", desc: "Debit / Credit / RuPay", instant: true },
  { id: "cash" as const, label: "Cash", icon: "💵", desc: "Pay at counter or table — no online charge", instant: false },
  { id: "nfc" as const, label: "NFC Tap", icon: "📡", desc: "Contactless — needs a live gateway", instant: true },
  { id: "qr" as const, label: "QR Payment", icon: "🔲", desc: "Scan & pay — not wired yet", instant: true },
  { id: "wallet" as const, label: "Wallet", icon: "👛", desc: "Venue wallet — needs wallet enabled", instant: true },
  { id: "netbanking" as const, label: "Net Banking", icon: "🏦", desc: "Needs a live payment gateway", instant: true },
];

/**
 * Tips, as a share of the bill rather than a fixed list of rupee amounts.
 *
 * The presets were `[0, 20, 50, 100, 150, 200]`, the same six figures whatever the bill
 * came to. On a ₹45 tea and dosa the smallest tip offered was ₹20 — 44% — and the
 * options ran to 444%. On a ₹5,000 dinner the largest was 4%. Percentages of the bill
 * behave sensibly at both ends, and are what a diner expects to be asked.
 */
export const TIP_PERCENT_PRESETS = [0, 5, 10, 15, 20];

/** Rounded to the nearest rupee — nobody tips in paise. */
export function tipPresetsFor(billTotal: number): { percent: number; amount: number }[] {
  const base = Number.isFinite(billTotal) && billTotal > 0 ? billTotal : 0;
  return TIP_PERCENT_PRESETS.map(percent => ({ percent, amount: Math.round((base * percent) / 100) }));
}
export const GST_RATE = 0.05;
export const CGST_RATE = 0.025;
export const SGST_RATE = 0.025;

export const DEMO_BILL = {
  subtotal: 1180,
  discount: 0,
  items: [
    { name: "Paneer Tikka", qty: 1, price: 320 },
    { name: "Chicken Biryani", qty: 1, price: 480 },
    { name: "Masala Chai", qty: 2, price: 190 },
  ],
};

export interface BillQuoteInput {
  subtotal: number;
  discount?: number;
  tip?: number;
  splitCount?: number;
  partialPayNow?: number;
  advanceAmount?: number;
}

export interface GstBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  gstRate: number;
}

export interface BillQuote {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gst: GstBreakdown;
  tip: number;
  grandTotal: number;
  splitPerPerson?: number;
  partialPayNow?: number;
  partialRemaining?: number;
  advanceAmount?: number;
  balanceDue?: number;
}

export interface SplitPaymentLine {
  method: PaymentModeId;
  amount: number;
}

export function computeGstBreakdown(taxableAmount: number): GstBreakdown {
  const cgst = Math.round(taxableAmount * CGST_RATE * 100) / 100;
  const sgst = Math.round(taxableAmount * SGST_RATE * 100) / 100;
  return {
    taxableAmount,
    cgst,
    sgst,
    totalGst: Math.round((cgst + sgst) * 100) / 100,
    gstRate: GST_RATE,
  };
}

export function computeBillQuote(input: BillQuoteInput): BillQuote {
  const subtotal = input.subtotal;
  const discount = input.discount ?? 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const gst = computeGstBreakdown(taxableAmount);
  const tip = input.tip ?? 0;
  const grandTotal = Math.round((taxableAmount + gst.totalGst + tip) * 100) / 100;

  const quote: BillQuote = { subtotal, discount, taxableAmount, gst, tip, grandTotal };

  if (input.splitCount && input.splitCount > 1) {
    quote.splitPerPerson = Math.ceil(grandTotal / input.splitCount);
  }
  if (input.partialPayNow != null && input.partialPayNow > 0 && input.partialPayNow < grandTotal) {
    quote.partialPayNow = input.partialPayNow;
    quote.partialRemaining = Math.round((grandTotal - input.partialPayNow) * 100) / 100;
  }
  if (input.advanceAmount != null && input.advanceAmount > 0 && input.advanceAmount < grandTotal) {
    quote.advanceAmount = input.advanceAmount;
    quote.balanceDue = Math.round((grandTotal - input.advanceAmount) * 100) / 100;
  }
  return quote;
}

export function validateSplitPayments(splits: SplitPaymentLine[], total: number): boolean {
  if (!splits.length) return false;
  const sum = splits.reduce((s, l) => s + l.amount, 0);
  return Math.abs(sum - total) < 0.01;
}

export function paymentModeLabel(id: string): string {
  return PAYMENT_MODES.find(m => m.id === id)?.label ?? id;
}
