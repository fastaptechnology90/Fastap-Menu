/** Minimal PDF 1.4 generator for GST invoices (no external deps). */
type Invoice = {
  orderId: number;
  /** Null until the bill is settled: an unpaid order gets a proforma, not a tax invoice. */
  invoiceNumber: string | null;
  isTaxInvoice: boolean;
  documentTitle: string;
  invoiceDate: string;
  restaurantName: string;
  restaurantGstin: string | null;
  customerName: string;
  tableName?: string;
  items: { name: string; qty: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  gstRoundingAdjustment?: number;
  cgstRatePercent?: number;
  sgstRatePercent?: number;
  /** Alcohol sits outside GST and carries state excise/VAT on its own line. */
  liquorTaxableAmount?: number;
  liquorTax?: number;
  liquorRatePercent?: number;
  grandTotal: number;
  paymentMethod?: string | null;
};

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildInvoicePdfBuffer(invoice: Invoice): Buffer {
  const lines: string[] = [
    `${invoice.documentTitle} — ${invoice.restaurantName}`,
    invoice.restaurantGstin ? `GSTIN: ${invoice.restaurantGstin}` : "Not registered for GST",
    invoice.isTaxInvoice
      ? `Invoice: ${invoice.invoiceNumber}`
      : `Order #${invoice.orderId} — no invoice number until the bill is settled`,
    `Date: ${new Date(invoice.invoiceDate).toLocaleString()}`,
    `Customer: ${invoice.customerName}${invoice.tableName ? ` · Table ${invoice.tableName}` : ""}`,
    "",
    "Item                          Qty    Rate      Amount",
    ...invoice.items.map(i =>
      `${i.name.slice(0, 28).padEnd(28)} ${String(i.qty).padStart(3)}  ${i.rate.toFixed(2).padStart(8)}  ${i.amount.toFixed(2).padStart(10)}`,
    ),
    "",
    `Subtotal: INR ${invoice.subtotal.toFixed(2)}`,
    invoice.discount > 0 ? `Discount: -INR ${invoice.discount.toFixed(2)}` : "",
    `CGST (${invoice.cgstRatePercent ?? 2.5}%): INR ${invoice.cgst.toFixed(2)}`,
    `SGST (${invoice.sgstRatePercent ?? 2.5}%): INR ${invoice.sgst.toFixed(2)}`,
    invoice.gstRoundingAdjustment ? `Round off: INR ${invoice.gstRoundingAdjustment.toFixed(2)}` : "",
    (invoice.liquorTaxableAmount ?? 0) > 0
      ? `Alcoholic beverages (outside GST): INR ${(invoice.liquorTaxableAmount ?? 0).toFixed(2)}`
      : "",
    (invoice.liquorTaxableAmount ?? 0) > 0
      ? `Excise / VAT on liquor (${invoice.liquorRatePercent ?? 0}%): INR ${(invoice.liquorTax ?? 0).toFixed(2)}`
      : "",
    `Grand Total: INR ${invoice.grandTotal.toFixed(2)}`,
    invoice.paymentMethod ? `Payment: ${invoice.paymentMethod}` : "",
    "",
    invoice.isTaxInvoice
      ? "Computer-generated GST invoice"
      : "Proforma bill — not a tax invoice; a number is issued when the bill is settled",
  ].filter(Boolean);

  let y = 800;
  const content: string[] = ["BT", "/F1 10 Tf"];
  for (const line of lines) {
    content.push(`1 0 0 1 50 ${y} Tm (${esc(line)}) Tj`);
    y -= 14;
  }
  content.push("ET");
  const stream = content.join("\n");
  const streamLen = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
