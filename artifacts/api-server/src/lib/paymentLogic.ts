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

  // Each half is half of the tax, equally. The old code took `cgst = round(totalGst / 2)`
  // and then `sgst = totalGst - cgst`, so a tax landing on an odd number of paise printed
  // as CGST 1.63 / SGST 1.62 — unequal halves on roughly half of all bills, which is
  // legally malformed. Under GST the two components are computed the same way from the
  // same taxable value and are therefore always equal.
  const half = Math.round((totalGst / 2) * 100) / 100;
  const cgst = half;
  const sgst = half;
  // New bills are priced as two equal halves upstream, so this is 0. It exists for bills
  // raised before that, whose stored tax cannot be split into two equal paise amounts: the
  // odd paisa is shown as a round-off rather than hidden inside one of the halves.
  const roundingAdjustment = Math.round((totalGst - cgst - sgst) * 100) / 100;

  // When the invoice restates a stored tax, the caption has to describe that tax — not
  // the configured rate, which may have been changed since the bill was raised.
  const effectiveRate = taxableAmount > 0 ? totalGst / taxableAmount : usableRate;
  const halfPercent = Math.round((effectiveRate / 2) * 10000) / 100;
  return {
    taxableAmount,
    cgst,
    sgst,
    roundingAdjustment,
    totalGst,
    gstRate: Math.round(effectiveRate * 10000) / 10000,
    gstRatePercent: Math.round(effectiveRate * 10000) / 100,
    cgstRatePercent: halfPercent,
    sgstRatePercent: halfPercent,
    hsn: "996331",
    sac: "Restaurant services",
  };
}

/** The Indian financial year a date falls in, e.g. "2026-27". Numbering restarts each April. */
export function financialYearOf(when: Date): string {
  const y = when.getFullYear();
  const startYear = when.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Format a number drawn from the venue's own consecutive series. */
export function formatInvoiceNumber(restaurantId: number, financialYear: string, serial: number): string {
  return `INV-SG${restaurantId}-${financialYear}-${String(serial).padStart(5, "0")}`;
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
  const orderMeta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const storedBilling = (typeof orderMeta.billing === "object" && orderMeta.billing !== null ? orderMeta.billing : {}) as Record<string, unknown>;
  // Alcohol sits outside GST, so its tax must not be apportioned into CGST and SGST. The
  // split recorded when the order was priced says how much of the tax was which; an order
  // raised before that record existed is treated as all food, exactly as it was billed.
  const storedTaxSplit = (typeof storedBilling.tax === "object" && storedBilling.tax !== null ? storedBilling.tax : null) as
    { foodTaxable?: unknown; liquorTaxable?: unknown; gst?: unknown; liquorTax?: unknown; liquorRatePercent?: unknown } | null;
  const liquorTaxable = parseNum(storedTaxSplit?.liquorTaxable);
  const liquorTax = parseNum(storedTaxSplit?.liquorTax);
  const gstTaxable = storedTaxSplit ? parseNum(storedTaxSplit.foodTaxable) : taxableAmount;
  const gstAmount = storedTaxSplit ? parseNum(storedTaxSplit.gst) : storedTax;
  const gst = computeGstBreakdown(
    gstTaxable,
    billingSettings?.taxRate,
    Number.isFinite(gstAmount) && gstAmount > 0 ? gstAmount : undefined,
  );
  const tip = parseNum(order.tipAmount);
  const total = parseNum(order.total);
  const items = Array.isArray(order.items) ? order.items : [];
  const meta = orderMeta;
  const metaBilling = storedBilling;

  // A tax invoice is the record of a completed sale. One used to be issued for any order
  // that was merely looked at — including a payment that had just FAILED — and it burnt a
  // number from a series that has to be consecutive. Until the money is in, this is a
  // proforma: it prices the meal, it carries no invoice number, and it says so.
  const settled = ["paid", "partially_refunded", "refunded"].includes(String(order.paymentStatus ?? ""));

  return {
    orderId: order.id,
    invoiceNumber: settled ? (order.invoiceNumber ?? null) : null,
    /** False means this is a proforma bill, not a tax invoice — nothing has been paid yet. */
    isTaxInvoice: settled && Boolean(order.invoiceNumber),
    documentTitle: settled && order.invoiceNumber ? "TAX INVOICE" : "PROFORMA BILL — NOT A TAX INVOICE",
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
    /** The part of the bill GST is charged on — alcohol is excluded from it. */
    gstTaxableAmount: gst.taxableAmount,
    cgst: gst.cgst,
    sgst: gst.sgst,
    gstRoundingAdjustment: gst.roundingAdjustment,
    totalGst: gst.totalGst,
    /** Alcohol: outside GST, taxed on its own line at the state's excise/VAT rate. */
    liquorTaxableAmount: liquorTaxable,
    liquorTax,
    liquorRatePercent: parseNum(storedTaxSplit?.liquorRatePercent),
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
<html><head><meta charset="utf-8"><title>${invoice.isTaxInvoice ? `Invoice ${invoice.invoiceNumber}` : `Bill for order #${invoice.orderId}`}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left} th{background:#f5f5f5}
  .totals{margin-top:16px;font-size:14px} .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .grand{font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:8px;padding-top:8px}
  .gst-box{background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:8px;margin-top:16px;font-size:13px}
</style></head><body>
  <h1>${invoice.documentTitle}</h1>
  <p class="muted">${invoice.restaurantName}${invoice.restaurantAddress ? ` · ${invoice.restaurantAddress}` : ""}</p>
  <p class="muted">${invoice.restaurantGstin ? `GSTIN: ${invoice.restaurantGstin}` : "Not registered for GST"}</p>
  <p class="muted">${invoice.isTaxInvoice ? `Invoice: <strong>${invoice.invoiceNumber}</strong>` : `Order #${invoice.orderId} · no invoice number is issued until the bill is settled`} · Date: ${new Date(invoice.invoiceDate).toLocaleString()}</p>
  <p>Customer: ${invoice.customerName}${invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}${invoice.tableName ? ` · Table ${invoice.tableName}` : ""}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
    ${invoice.discount > 0 ? `<div><span>Discount</span><span>-₹${invoice.discount.toFixed(2)}</span></div>` : ""}
    <div><span>Taxable Amount</span><span>₹${invoice.taxableAmount.toFixed(2)}</span></div>
    ${invoice.liquorTaxableAmount > 0 ? `<div><span>Of which GST-taxable (food &amp; beverage)</span><span>₹${invoice.gstTaxableAmount.toFixed(2)}</span></div>` : ""}
    <div><span>CGST (${invoice.cgstRatePercent}%)</span><span>₹${invoice.cgst.toFixed(2)}</span></div>
    <div><span>SGST (${invoice.sgstRatePercent}%)</span><span>₹${invoice.sgst.toFixed(2)}</span></div>
    ${invoice.gstRoundingAdjustment !== 0 ? `<div><span>Round off</span><span>₹${invoice.gstRoundingAdjustment.toFixed(2)}</span></div>` : ""}
    ${invoice.liquorTaxableAmount > 0 ? `<div><span>Alcoholic beverages (outside GST)</span><span>₹${invoice.liquorTaxableAmount.toFixed(2)}</span></div>` : ""}
    ${invoice.liquorTaxableAmount > 0 ? `<div><span>Excise / VAT on liquor (${invoice.liquorRatePercent}%)</span><span>₹${invoice.liquorTax.toFixed(2)}</span></div>` : ""}
    ${invoice.tip > 0 ? `<div><span>Tip</span><span>₹${invoice.tip.toFixed(2)}</span></div>` : ""}
    <div class="grand"><span>Grand Total</span><span>₹${invoice.grandTotal.toFixed(2)}</span></div>
  </div>
  <div class="gst-box">
    <strong>GST Summary</strong> — SAC: ${invoice.sac} · HSN: 996331<br>
    Payment: ${invoice.paymentMethod ?? "—"} · Status: ${invoice.paymentStatus ?? "pending"}
  </div>
  <p class="muted" style="margin-top:24px">${invoice.isTaxInvoice
    ? "This is a computer-generated GST invoice."
    : "This is a proforma bill. It is not a tax invoice and carries no invoice number; one is issued when the bill is settled."}</p>
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
