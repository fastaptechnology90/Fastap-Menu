export type PaymentModeId = "upi" | "card" | "cash" | "nfc" | "qr" | "wallet" | "netbanking";

export const PAYMENT_MODES = [
  { id: "upi", label: "UPI", instant: true },
  { id: "card", label: "Card", instant: true },
  { id: "cash", label: "Cash", instant: false },
  { id: "nfc", label: "NFC Tap", instant: true },
  { id: "qr", label: "QR Payment", instant: true },
  { id: "wallet", label: "Wallet", instant: true },
  { id: "netbanking", label: "Net Banking", instant: true },
];

/**
 * The rate to fall back on when a venue has not configured one. It is the rate the code
 * hardcoded everywhere before, so an unconfigured venue bills exactly as it used to.
 */
const DEFAULT_GST_RATE = 0.05;

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

export function generateInvoiceNumber(orderId: number, restaurantId?: number): string {
  const prefix = restaurantId ? `SG${restaurantId}` : "FM";
  const year = new Date().getFullYear();
  return `INV-${prefix}-${year}-${String(orderId).padStart(5, "0")}`;
}

/**
 * Split GST into its halves at the venue's own rate.
 *
 * The rate was fixed at 5% here while the ordering code already read a per-venue rate,
 * so a venue billing at any other rate got an invoice whose tax lines disagreed with the
 * bill the guest paid — and the CGST/SGST captions said 2.5% regardless. The rates come
 * back with the numbers so a caption can never drift from the arithmetic again.
 *
 * `actualTax` is the tax the order really carries: when it is supplied, that is what the
 * invoice apportions, so the invoice restates the bill instead of recomputing it.
 */
export function computeGstBreakdown(taxableAmount: number, rate = DEFAULT_GST_RATE, actualTax?: number) {
  const usableRate = Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_GST_RATE;
  const totalGst = actualTax != null && Number.isFinite(actualTax) && actualTax >= 0
    ? Math.round(actualTax * 100) / 100
    : Math.round(taxableAmount * usableRate * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100;
  // When the invoice restates a stored tax, the caption has to describe that tax — not
  // the configured rate, which may have been changed since the bill was raised.
  const effectiveRate = taxableAmount > 0 ? totalGst / taxableAmount : usableRate;
  const halfPercent = Math.round((effectiveRate / 2) * 10000) / 100;
  return {
    taxableAmount,
    cgst,
    sgst,
    totalGst,
    gstRate: Math.round(effectiveRate * 10000) / 10000,
    gstRatePercent: Math.round(effectiveRate * 10000) / 100,
    cgstRatePercent: halfPercent,
    sgstRatePercent: halfPercent,
    hsn: "996331",
    sac: "Restaurant services",
  };
}

export function computeBillQuote(input: {
  subtotal: number;
  discount?: number;
  tip?: number;
  splitCount?: number;
  partialPayNow?: number;
  advanceAmount?: number;
  taxRate?: number;
}) {
  const subtotal = input.subtotal;
  const discount = input.discount ?? 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const gst = computeGstBreakdown(taxableAmount, input.taxRate);
  const tip = input.tip ?? 0;
  const grandTotal = Math.round((taxableAmount + gst.totalGst + tip) * 100) / 100;

  const quote: Record<string, number | undefined> = {
    subtotal, discount, taxableAmount, tip, grandTotal,
    cgst: gst.cgst, sgst: gst.sgst, totalGst: gst.totalGst,
  };

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
  return { ...quote, gst };
}

export function resolvePaymentStatus(
  paymentMethod: string | null | undefined,
  billing?: { partialPayNow?: number; advanceAmount?: number; grandTotal?: number },
): string {
  // A real part-payment decides the status regardless of method, so check it first.
  if (billing?.partialPayNow && billing.grandTotal && billing.partialPayNow < billing.grandTotal) return "partial";
  if (billing?.advanceAmount && billing.grandTotal && billing.advanceAmount < billing.grandTotal) return "advance";
  // No method means nothing has been collected yet — the normal dine-in case,
  // where the guest orders now and the waiter takes the money at the table.
  // Treating that as "paid" marked money collected before anyone had paid.
  if (!paymentMethod || paymentMethod === "cash") return "pending";
  return "paid";
}

export function buildGstInvoice(order: {
  id: number;
  restaurantId: number;
  invoiceNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableName?: string | null;
  items: unknown;
  subtotal: unknown;
  tax: unknown;
  discountAmount?: unknown;
  tipAmount?: unknown;
  total: unknown;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  createdAt: Date;
  metadata?: unknown;
}, restaurantName = "Restaurant", billingSettings?: { gstin?: string | null; legalName?: string; address?: string; taxRate?: number }) {
  const subtotal = parseNum(order.subtotal);
  const discount = parseNum(order.discountAmount);
  const taxableAmount = Math.max(0, subtotal - discount);
  // The tax on the order is what the guest was charged; the invoice restates it rather
  // than recomputing it at whatever rate happens to be configured today.
  const storedTax = parseNum(order.tax, NaN);
  const gst = computeGstBreakdown(
    taxableAmount,
    billingSettings?.taxRate,
    Number.isFinite(storedTax) && storedTax > 0 ? storedTax : undefined,
  );
  const tip = parseNum(order.tipAmount);
  const total = parseNum(order.total);
  const items = Array.isArray(order.items) ? order.items : [];
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const metaBilling = (typeof meta.billing === "object" && meta.billing !== null ? meta.billing : {}) as Record<string, unknown>;

  return {
    invoiceNumber: order.invoiceNumber ?? generateInvoiceNumber(order.id, order.restaurantId),
    invoiceDate: order.createdAt.toISOString(),
    restaurantName: (metaBilling.legalName as string) || billingSettings?.legalName || restaurantName,
    // A GSTIN that is not the venue's own turns a tax invoice into a false document.
    // An unregistered venue now says so; it never borrows somebody else's number.
    restaurantGstin: ((metaBilling.gstin as string) || billingSettings?.gstin || null),
    restaurantAddress: (metaBilling.address as string) ?? billingSettings?.address ?? "",
    customerName: order.customerName ?? "Guest",
    customerPhone: order.customerPhone ?? "",
    tableName: order.tableName ?? "",
    items: items.map((i: any) => ({
      name: i.name,
      qty: i.quantity ?? 1,
      rate: parseNum(i.price),
      amount: parseNum(i.subtotal ?? i.price),
      hsn: gst.hsn,
    })),
    subtotal,
    discount,
    taxableAmount,
    cgst: gst.cgst,
    sgst: gst.sgst,
    totalGst: gst.totalGst,
    gstRatePercent: gst.gstRatePercent,
    cgstRatePercent: gst.cgstRatePercent,
    sgstRatePercent: gst.sgstRatePercent,
    gstRegistered: Boolean((metaBilling.gstin as string) || billingSettings?.gstin),
    tip,
    grandTotal: total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    billing: metaBilling,
    sac: gst.sac,
  };
}

export function buildInvoiceHtml(invoice: ReturnType<typeof buildGstInvoice>): string {
  const rows = invoice.items.map(i =>
    `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.rate.toFixed(2)}</td><td>₹${i.amount.toFixed(2)}</td></tr>`,
  ).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left} th{background:#f5f5f5}
  .totals{margin-top:16px;font-size:14px} .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .grand{font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:8px;padding-top:8px}
  .gst-box{background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:8px;margin-top:16px;font-size:13px}
</style></head><body>
  <h1>TAX INVOICE</h1>
  <p class="muted">${invoice.restaurantName}${invoice.restaurantAddress ? ` · ${invoice.restaurantAddress}` : ""}</p>
  <p class="muted">${invoice.restaurantGstin ? `GSTIN: ${invoice.restaurantGstin}` : "Not registered for GST"}</p>
  <p class="muted">Invoice: <strong>${invoice.invoiceNumber}</strong> · Date: ${new Date(invoice.invoiceDate).toLocaleString()}</p>
  <p>Customer: ${invoice.customerName}${invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}${invoice.tableName ? ` · Table ${invoice.tableName}` : ""}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
    ${invoice.discount > 0 ? `<div><span>Discount</span><span>-₹${invoice.discount.toFixed(2)}</span></div>` : ""}
    <div><span>Taxable Amount</span><span>₹${invoice.taxableAmount.toFixed(2)}</span></div>
    <div><span>CGST (${invoice.cgstRatePercent}%)</span><span>₹${invoice.cgst.toFixed(2)}</span></div>
    <div><span>SGST (${invoice.sgstRatePercent}%)</span><span>₹${invoice.sgst.toFixed(2)}</span></div>
    ${invoice.tip > 0 ? `<div><span>Tip</span><span>₹${invoice.tip.toFixed(2)}</span></div>` : ""}
    <div class="grand"><span>Grand Total</span><span>₹${invoice.grandTotal.toFixed(2)}</span></div>
  </div>
  <div class="gst-box">
    <strong>GST Summary</strong> — SAC: ${invoice.sac} · HSN: 996331<br>
    Payment: ${invoice.paymentMethod ?? "—"} · Status: ${invoice.paymentStatus ?? "pending"}
  </div>
  <p class="muted" style="margin-top:24px">This is a computer-generated GST invoice from FastMenu.</p>
</body></html>`;
}

export function getPaymentCatalog() {
  return {
    paymentModes: PAYMENT_MODES,
    tipPresets: [0, 20, 50, 100, 150, 200],
    gstRate: DEFAULT_GST_RATE,
    billingFeatures: ["split_payment", "partial_payment", "advance_payment", "tip_management", "gst_invoice", "pdf_invoice"],
  };
}

export function validateSplitPayments(splits: { method: string; amount: number }[], total: number): boolean {
  if (!splits.length) return false;
  const sum = splits.reduce((s, l) => s + parseNum(l.amount), 0);
  return Math.abs(sum - total) < 0.01;
}
