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

const GST_RATE = 0.05;
const CGST_RATE = 0.025;
const SGST_RATE = 0.025;

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

export function generateInvoiceNumber(orderId: number, restaurantId?: number): string {
  const prefix = restaurantId ? `SG${restaurantId}` : "FM";
  const year = new Date().getFullYear();
  return `INV-${prefix}-${year}-${String(orderId).padStart(5, "0")}`;
}

export function computeGstBreakdown(taxableAmount: number) {
  const cgst = Math.round(taxableAmount * CGST_RATE * 100) / 100;
  const sgst = Math.round(taxableAmount * SGST_RATE * 100) / 100;
  return {
    taxableAmount,
    cgst,
    sgst,
    totalGst: Math.round((cgst + sgst) * 100) / 100,
    gstRate: GST_RATE,
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
}) {
  const subtotal = input.subtotal;
  const discount = input.discount ?? 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const gst = computeGstBreakdown(taxableAmount);
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
  // No method chosen is the normal dine-in case — the guest orders now and pays
  // at the end. Treating that as "paid" marked money collected before anyone
  // had paid, showed the order as Paid in the panel, and bucketed it under Cash
  // in the revenue split. Only an actually-prepaid method (UPI/card at
  // checkout) may start as paid.
  if (!paymentMethod || paymentMethod === "cash") return "pending";
  if (billing?.partialPayNow && billing.grandTotal && billing.partialPayNow < billing.grandTotal) return "partial";
  if (billing?.advanceAmount && billing.grandTotal && billing.advanceAmount < billing.grandTotal) return "advance";
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
}, restaurantName = "Restaurant", billingSettings?: { gstin?: string; legalName?: string; address?: string }) {
  const subtotal = parseNum(order.subtotal);
  const discount = parseNum(order.discountAmount);
  const taxableAmount = Math.max(0, subtotal - discount);
  const gst = computeGstBreakdown(taxableAmount);
  const tip = parseNum(order.tipAmount);
  const total = parseNum(order.total);
  const items = Array.isArray(order.items) ? order.items : [];
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const metaBilling = (typeof meta.billing === "object" && meta.billing !== null ? meta.billing : {}) as Record<string, unknown>;

  return {
    invoiceNumber: order.invoiceNumber ?? generateInvoiceNumber(order.id, order.restaurantId),
    invoiceDate: order.createdAt.toISOString(),
    restaurantName: (metaBilling.legalName as string) || billingSettings?.legalName || restaurantName,
    restaurantGstin: (metaBilling.gstin as string) ?? billingSettings?.gstin ?? "27AABCU9603R1ZM",
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
  <p class="muted">GSTIN: ${invoice.restaurantGstin}</p>
  <p class="muted">Invoice: <strong>${invoice.invoiceNumber}</strong> · Date: ${new Date(invoice.invoiceDate).toLocaleString()}</p>
  <p>Customer: ${invoice.customerName}${invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}${invoice.tableName ? ` · Table ${invoice.tableName}` : ""}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
    ${invoice.discount > 0 ? `<div><span>Discount</span><span>-₹${invoice.discount.toFixed(2)}</span></div>` : ""}
    <div><span>Taxable Amount</span><span>₹${invoice.taxableAmount.toFixed(2)}</span></div>
    <div><span>CGST (2.5%)</span><span>₹${invoice.cgst.toFixed(2)}</span></div>
    <div><span>SGST (2.5%)</span><span>₹${invoice.sgst.toFixed(2)}</span></div>
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
    gstRate: GST_RATE,
    billingFeatures: ["split_payment", "partial_payment", "advance_payment", "tip_management", "gst_invoice", "pdf_invoice"],
  };
}

export function validateSplitPayments(splits: { method: string; amount: number }[], total: number): boolean {
  if (!splits.length) return false;
  const sum = splits.reduce((s, l) => s + parseNum(l.amount), 0);
  return Math.abs(sum - total) < 0.01;
}
