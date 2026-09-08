import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ordersTable, restaurantsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { billingFromSettings } from "../lib/restaurant-catalogs.js";
import { round2 } from "../lib/order-pricing.js";
import { logger } from "../lib/logger.js";

/**
 * Printing a kitchen ticket and a customer bill.
 *
 * Neither existed. A restaurant runs on two pieces of paper — the KOT that goes to the
 * pass and the bill that goes to the table — and the product could produce neither, so
 * every venue using it was writing dockets by hand beside a screen that already knew
 * what was ordered. There was no `@media print` rule anywhere in the panel either, so
 * even Ctrl-P produced the whole dashboard.
 *
 * Both documents are rendered server-side as a self-contained page sized for an 80mm
 * thermal roll, which is what a restaurant printer actually is; on A4 it simply centres.
 * The panel opens the returned HTML and calls print, so nothing depends on a driver or
 * an extension being installed.
 *
 * A reprint is recorded on the order. That is the point of a reprint being a named
 * action rather than pressing Ctrl-P twice: a second copy of a bill is how a table gets
 * charged twice or a voided sale walks out of the till, so who asked for it and when is
 * part of the record.
 */

const router: IRouter = Router();

type Line = {
  name?: string; quantity?: number; qty?: number; price?: number; subtotal?: number;
  variant?: string | null; addons?: { name?: string; price?: number }[];
  notes?: string; voided?: boolean; comped?: boolean;
  voidReason?: string; compReason?: string;
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** HTML-escape everything that comes from a menu, a guest or a staff note. */
function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

const money = (n: number) => `₹${n.toFixed(2)}`;

/**
 * 80mm thermal is the default because that is the printer on the counter. `@media print`
 * strips the screen chrome; `@page` removes the browser's own margins, which otherwise
 * push a narrow roll onto a second page.
 */
const STYLE = `
  *{box-sizing:border-box}
  body{font-family:ui-monospace,"Courier New",monospace;color:#000;background:#fff;margin:0;padding:8px;
       width:80mm;max-width:100%;font-size:12px;line-height:1.35}
  h1{font-size:15px;margin:0;text-align:center;letter-spacing:.5px}
  .sub{text-align:center;font-size:11px;margin:2px 0}
  .rule{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:1px 0;vertical-align:top}
  .qty{width:26px}
  .amt{text-align:right;white-space:nowrap}
  .row{display:flex;justify-content:space-between;gap:8px}
  .grand{font-weight:700;font-size:14px}
  .note{font-size:10px;padding-left:26px}
  .struck{text-decoration:line-through}
  .flag{font-size:10px;padding-left:26px;font-weight:700}
  .foot{text-align:center;font-size:10px;margin-top:8px}
  .big{font-size:16px;font-weight:700;text-align:center}
  @page{size:80mm auto;margin:2mm}
  @media print{.no-print{display:none!important}body{padding:0}}
  @media screen and (min-width:600px){body{margin:16px auto;border:1px solid #ddd}}
`;

function page(title: string, body: string, autoPrint: boolean) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body>${body}
<div class="no-print" style="text-align:center;margin-top:12px">
  <button onclick="window.print()" style="padding:8px 16px;font:inherit;cursor:pointer">Print</button>
</div>
${autoPrint ? "<script>window.addEventListener('load',()=>window.print())</script>" : ""}
</body></html>`;
}

async function loadOrder(restaurantId: number, orderId: number) {
  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) return null;
  const [venue] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  return { order, venue };
}

const linesOf = (order: { items: unknown }) => (Array.isArray(order.items) ? order.items : []) as Line[];
const qtyOf = (l: Line) => Number(l.quantity ?? l.qty ?? 1) || 1;

/**
 * The kitchen ticket. No prices — a cook does not need them and they slow the ticket
 * down. Voided and comped lines are printed struck through rather than dropped, because
 * the pass has to know a dish was pulled after it was already called.
 */
function kotHtml(order: any, venue: any, copy: number) {
  const lines = linesOf(order);
  const rows = lines.map(l => {
    const flags = [
      l.voided ? `<div class="flag">** VOIDED — ${esc(l.voidReason ?? "no reason given")} **</div>` : "",
      l.comped ? `<div class="flag">** COMPED — ${esc(l.compReason ?? "no reason given")} **</div>` : "",
      l.variant ? `<div class="note">${esc(l.variant)}</div>` : "",
      ...(Array.isArray(l.addons) ? l.addons.map(a => `<div class="note">+ ${esc(a?.name)}</div>`) : []),
      l.notes ? `<div class="note">NOTE: ${esc(l.notes)}</div>` : "",
    ].join("");
    return `<tr><td class="qty">${qtyOf(l)}x</td><td class="${l.voided || l.comped ? "struck" : ""}">${esc(l.name)}${flags}</td></tr>`;
  }).join("");

  return page(`KOT ${order.id}`, `
  <h1>KITCHEN ORDER TICKET</h1>
  <p class="sub">${esc(venue?.name ?? "")}</p>
  <div class="rule"></div>
  <div class="row"><span>Order #${order.id}</span><span>${esc(order.tableName ?? order.type ?? "")}</span></div>
  <div class="row"><span>${new Date(order.createdAt).toLocaleString("en-IN")}</span><span>${esc(order.waiterName ?? "")}</span></div>
  ${copy > 1 ? `<p class="big">REPRINT #${copy}</p>` : ""}
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  ${order.notes ? `<p>ORDER NOTE: ${esc(order.notes)}</p>` : ""}
  <p class="foot">${lines.reduce((t, l) => t + qtyOf(l), 0)} items</p>
`, true);
}

/**
 * The customer bill. Voided and comped lines appear at ₹0.00 with the reason, so the
 * printed total reconciles against what was actually served — showing them at full
 * price, as the old invoice template did, left a bill whose lines did not add up to its
 * own total.
 */
function billHtml(order: any, venue: any, copy: number) {
  const lines = linesOf(order);
  const billing = billingFromSettings(
    (venue?.settings && typeof venue.settings === "object" ? venue.settings : {}) as Record<string, unknown>,
    venue,
  );

  const rows = lines.map(l => {
    const dropped = l.voided || l.comped;
    const amount = dropped ? 0 : num(l.subtotal ?? num(l.price) * qtyOf(l));
    const reason = l.voided ? `VOID: ${esc(l.voidReason ?? "")}` : l.comped ? `COMP: ${esc(l.compReason ?? "")}` : "";
    return `<tr>
      <td class="qty">${qtyOf(l)}</td>
      <td class="${dropped ? "struck" : ""}">${esc(l.name)}${reason ? `<div class="note">${reason}</div>` : ""}</td>
      <td class="amt">${money(amount)}</td>
    </tr>`;
  }).join("");

  const subtotal = num(order.subtotal);
  const discount = num(order.discountAmount);
  const tax = num(order.tax);
  const tip = num(order.tipAmount);
  const half = round2(tax / 2);
  // Prefer the rate the venue has configured; where it has set none, derive it from the
  // tax actually charged rather than leaving the caption blank — a bill that says "CGST"
  // with no rate is not a valid tax invoice.
  const taxable = Math.max(0, round2(subtotal - discount));
  const ratePercent = billing.taxRate
    ? round2(billing.taxRate * 100)
    : taxable > 0 && tax > 0 ? round2((tax / taxable) * 100) : null;

  return page(`Bill ${order.invoiceNumber ?? order.id}`, `
  <h1>${esc(billing.legalName || venue?.name || "TAX INVOICE")}</h1>
  ${billing.address ? `<p class="sub">${esc(billing.address)}</p>` : venue?.address ? `<p class="sub">${esc(venue.address)}</p>` : ""}
  ${venue?.phone ? `<p class="sub">${esc(venue.phone)}</p>` : ""}
  <p class="sub">${billing.gstin ? `GSTIN: ${esc(billing.gstin)}` : "Not registered for GST"}</p>
  <div class="rule"></div>
  <div class="row"><span>Bill #${esc(order.invoiceNumber ?? order.id)}</span><span>${esc(order.tableName ?? order.type ?? "")}</span></div>
  <div class="row"><span>${new Date(order.createdAt).toLocaleString("en-IN")}</span><span>${esc(order.waiterName ?? "")}</span></div>
  ${order.customerName ? `<div class="row"><span>${esc(order.customerName)}</span><span>${esc(order.customerPhone ?? "")}</span></div>` : ""}
  ${copy > 1 ? `<p class="big">DUPLICATE COPY #${copy}</p>` : ""}
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
  ${discount > 0 ? `<div class="row"><span>Discount</span><span>-${money(discount)}</span></div>` : ""}
  ${tax > 0 ? `
    <div class="row"><span>CGST${ratePercent ? ` (${round2(ratePercent / 2)}%)` : ""}</span><span>${money(half)}</span></div>
    <div class="row"><span>SGST${ratePercent ? ` (${round2(ratePercent / 2)}%)` : ""}</span><span>${money(round2(tax - half))}</span></div>` : ""}
  ${tip > 0 ? `<div class="row"><span>Tip</span><span>${money(tip)}</span></div>` : ""}
  <div class="rule"></div>
  <div class="row grand"><span>TOTAL</span><span>${money(num(order.total))}</span></div>
  <div class="rule"></div>
  <div class="row"><span>${esc(order.paymentMethod ?? "Not collected")}</span><span>${esc(order.paymentStatus ?? "pending")}</span></div>
  <p class="foot">Thank you — please visit again</p>
`, true);
}

/** Record that a second copy was taken, and say which copy this is. */
async function countCopy(order: any, kind: "kot" | "bill", by: string) {
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const log = Array.isArray(meta.prints) ? meta.prints as Record<string, unknown>[] : [];
  const copy = log.filter(p => p.kind === kind).length + 1;
  await db.update(ordersTable)
    .set({ metadata: { ...meta, prints: [...log, { kind, copy, by, at: new Date().toISOString() }] } })
    .where(eq(ordersTable.id, order.id));
  return copy;
}

const actorOf = (req: any) =>
  req.session?.staffSession?.staffName ?? req.session?.staffSession?.email ?? req.session?.user?.email ?? "staff";

function send(res: any, html: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

/** The kitchen ticket. */
router.get("/restaurants/:restaurantId/orders/:orderId/kot", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const found = await loadOrder(restaurantId, orderId);
  if (!found) { res.status(404).json({ error: "Order not found" }); return; }
  const copy = await countCopy(found.order, "kot", actorOf(req));
  send(res, kotHtml(found.order, found.venue, copy));
});

/** The customer bill. */
router.get("/restaurants/:restaurantId/orders/:orderId/print", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const found = await loadOrder(restaurantId, orderId);
  if (!found) { res.status(404).json({ error: "Order not found" }); return; }
  const copy = await countCopy(found.order, "bill", actorOf(req));
  send(res, billHtml(found.order, found.venue, copy));
});

/**
 * A deliberate reprint. Same document, but it answers as JSON so the panel can confirm
 * which copy it is before opening a window, and it is the call an audit looks for.
 */
router.post("/restaurants/:restaurantId/orders/:orderId/reprint", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const kind = String(req.body?.kind ?? "bill") === "kot" ? "kot" : "bill";

  const found = await loadOrder(restaurantId, orderId);
  if (!found) { res.status(404).json({ error: "Order not found" }); return; }

  const by = actorOf(req);
  const copy = await countCopy(found.order, kind, by);
  const html = kind === "kot" ? kotHtml(found.order, found.venue, copy) : billHtml(found.order, found.venue, copy);

  logger.info({ restaurantId, orderId, kind, copy, by }, "document reprinted");
  res.json({
    kind,
    copy,
    by,
    at: new Date().toISOString(),
    url: `/api/restaurants/${restaurantId}/orders/${orderId}/${kind === "kot" ? "kot" : "print"}`,
    html,
  });
});

/** Who printed what, and how many times — the reason a reprint is a recorded action. */
router.get("/restaurants/:restaurantId/orders/:orderId/prints", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const found = await loadOrder(restaurantId, orderId);
  if (!found) { res.status(404).json({ error: "Order not found" }); return; }
  const meta = (typeof found.order.metadata === "object" && found.order.metadata !== null
    ? found.order.metadata : {}) as Record<string, unknown>;
  res.json({ prints: Array.isArray(meta.prints) ? meta.prints : [] });
});

export default router;
