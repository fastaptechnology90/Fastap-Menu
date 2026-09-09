import { Router, type IRouter } from "express";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, ordersTable, restaurantsTable } from "@workspace/db";
import {
  getPaymentCatalog, computeBillQuote, buildGstInvoice, buildInvoiceHtml,
  generateInvoiceNumber, validateSplitPayments, resolvePaymentStatus,
} from "../lib/paymentLogic.js";
import { buildInvoicePdfBuffer } from "../lib/invoicePdf.js";
import { billingFromSettings } from "../lib/restaurant-catalogs.js";
import { taxRateFor } from "../lib/order-pricing.js";
import { loadOwnedOrder } from "../lib/guest-order-access.js";
import { getPlatformSettingsRaw } from "../lib/platform-admin.js";
import { getPaymentsPublicConfig, isOnlinePaymentMethod, isCashPaymentMethod, processGatewayPayment } from "../lib/payment-gateway.js";

const router: IRouter = Router();

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

/**
 * How much to charge now. A guest may legitimately pay part of the bill, but the
 * figure is clamped to the order's own total: it used to be taken from the request
 * body as-is, so the amount charged had no relationship to what was owed.
 */
function payAmountForOrder(grandTotal: number, body: Record<string, unknown>): number {
  const requested = body.partialPayNow != null
    ? parseNum(body.partialPayNow)
    : body.advanceAmount != null
      ? parseNum(body.advanceAmount)
      : grandTotal;
  if (!Number.isFinite(requested) || requested <= 0) return grandTotal;
  return Math.min(requested, grandTotal);
}

/**
 * A receipt the guest can still open tomorrow.
 *
 * The invoice was reachable only from the browser session that placed and paid for the
 * order. Close the tab, run out of battery, hand the phone to whoever is splitting the
 * bill — and the GST invoice for money already handed over was gone for good, because
 * the only other way in was to guess the order id, which is exactly the hole that got
 * shut. The order now carries a receipt token: a long random string returned once, at
 * payment, that opens that one invoice and nothing else.
 */
function receiptTokenFor(order: { metadata: unknown }): string | null {
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const token = meta.receiptToken;
  return typeof token === "string" && token.length >= 16 ? token : null;
}

function newReceiptToken(): string {
  return `rct_${randomBytes(24).toString("hex")}`;
}

/** The order behind an invoice request: the caller's own, or one whose receipt token they hold. */
async function loadInvoiceOrder(req: Request, orderId: number) {
  const owned = await loadOwnedOrder(req, orderId);
  if (owned) return owned;

  const supplied = String(req.query.token ?? req.query.receiptToken ?? "").trim();
  if (!supplied || supplied.length < 16) return null;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return null;
  const stored = receiptTokenFor(order);
  return stored && stored === supplied ? order : null;
}

/**
 * The bill as the guest has to settle it.
 *
 * `buildGstInvoice` puts the tip on its own line and then prints a grand total that is
 * the order total — which never had the tip added to it. So a ₹29.40 bill with a ₹3 tip
 * showed "Tip ₹3.00" directly above "Grand Total ₹29.40", and the guest handed over
 * ₹29.40. Every tip taken on a printed bill was lost between the two lines.
 */
function guestInvoice(order: Parameters<typeof buildGstInvoice>[0], restaurantName: string, billing: Parameters<typeof buildGstInvoice>[2]) {
  const base = buildGstInvoice(order, restaurantName, billing);
  return { ...base, amountBeforeTip: base.grandTotal, grandTotal: Math.round((base.grandTotal + base.tip) * 100) / 100 };
}

router.get("/public/payments/catalog", async (_req, res) => {
  const settings = await getPlatformSettingsRaw();
  const payments = getPaymentsPublicConfig(settings.integrations);
  res.json({
    ...getPaymentCatalog(),
    ...payments,
  });
});

/**
 * A quote is worked out at the venue's own GST rate when the caller says which venue it
 * is for. Without that the guest saw 5% on the cart while the order was billed at the
 * configured rate, and the two disagreed at the moment of payment.
 */
router.post("/public/payments/quote", async (req, res): Promise<void> => {
  const { subtotal, discount, tip, splitCount, partialPayNow, advanceAmount, restaurantId } = req.body;
  if (subtotal == null) { res.status(400).json({ error: "subtotal required" }); return; }
  const rid = parseInt(String(restaurantId ?? ""), 10);
  const taxRate = Number.isFinite(rid) ? await taxRateFor(rid) : undefined;
  res.json(computeBillQuote({
    subtotal: parseNum(subtotal),
    discount: parseNum(discount),
    tip: parseNum(tip),
    splitCount: splitCount ? parseInt(String(splitCount), 10) : undefined,
    partialPayNow: partialPayNow != null ? parseNum(partialPayNow) : undefined,
    advanceAmount: advanceAmount != null ? parseNum(advanceAmount) : undefined,
    taxRate,
  }));
});

router.post("/public/payments/intent/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const settings = await getPlatformSettingsRaw();
  const paymentMethod = String(req.body.paymentMethod ?? order.paymentMethod ?? "upi");
  const grandTotal = parseNum(order.total);
  const amount = payAmountForOrder(grandTotal, req.body);

  if (isCashPaymentMethod(paymentMethod)) {
    res.json({ mode: "cash", success: true, amount });
    return;
  }

  const result = await processGatewayPayment(settings.integrations, {
    orderId,
    amount,
    paymentMethod,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    gatewayId: req.body.gatewayId ? String(req.body.gatewayId) : undefined,
  });

  if (!result.success) {
    res.status(402).json({ error: result.error ?? "Payment intent failed", gateway: result.gatewayId });
    return;
  }

  res.json({
    success: true,
    mode: result.mode,
    gatewayId: result.gatewayId,
    gatewayOrderId: result.gatewayOrderId,
    gatewayTxnId: result.gatewayTxnId,
    amount,
    clientConfig: result.clientConfig ?? null,
  });
});

router.post("/public/payments/process/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  // The order used to be fetched by id alone, with no check that the caller had
  // anything to do with it — so walking the sequential ids let anyone mark strangers'
  // orders as settled.
  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const {
    paymentMethod, tipAmount, splitPayments, partialPayNow, advanceAmount, payMethod,
    razorpayPaymentId, razorpayOrderId, razorpaySignature, stripePaymentIntentId, gatewayId,
  } = req.body;

  const settings = await getPlatformSettingsRaw();
  const method = String(paymentMethod ?? payMethod ?? order.paymentMethod ?? "upi");
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const grandTotal = parseNum(order.total);
  const chargeAmount = payAmountForOrder(grandTotal, req.body);

  const billing: Record<string, unknown> = {
    ...(typeof meta.billing === "object" && meta.billing !== null ? meta.billing as object : {}),
    paymentMethod: method,
    processedAt: new Date().toISOString(),
  };

  if (Array.isArray(splitPayments) && splitPayments.length) {
    if (!validateSplitPayments(splitPayments, grandTotal)) {
      res.status(400).json({ error: "Split payment amounts must equal total" }); return;
    }
    billing.splitPayment = { enabled: true, splits: splitPayments };
  }
  if (partialPayNow != null) {
    billing.partialPayment = { enabled: true, payNow: parseNum(partialPayNow), remaining: Math.max(0, grandTotal - parseNum(partialPayNow)) };
  }
  if (advanceAmount != null) {
    billing.advancePayment = { enabled: true, advanceAmount: parseNum(advanceAmount), balanceDue: Math.max(0, grandTotal - parseNum(advanceAmount)) };
  }

  let paymentStatus = resolvePaymentStatus(method, {
    partialPayNow: partialPayNow != null ? parseNum(partialPayNow) : undefined,
    advanceAmount: advanceAmount != null ? parseNum(advanceAmount) : undefined,
    grandTotal,
  });

  let gatewayMeta: Record<string, unknown> = {};

  if (isOnlinePaymentMethod(method)) {
    const gatewayResult = await processGatewayPayment(settings.integrations, {
      orderId,
      amount: chargeAmount,
      paymentMethod: method,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      gatewayId: gatewayId ? String(gatewayId) : undefined,
      razorpayPaymentId: razorpayPaymentId ? String(razorpayPaymentId) : undefined,
      razorpayOrderId: razorpayOrderId ? String(razorpayOrderId) : undefined,
      razorpaySignature: razorpaySignature ? String(razorpaySignature) : undefined,
      stripePaymentIntentId: stripePaymentIntentId ? String(stripePaymentIntentId) : undefined,
    });

    if (!gatewayResult.success) {
      await db.update(ordersTable).set({
        paymentMethod: method,
        paymentStatus: "failed",
        metadata: {
          ...meta,
          billing,
          gatewayResponse: { error: gatewayResult.error, gatewayId: gatewayResult.gatewayId },
        },
      }).where(eq(ordersTable.id, orderId));
      res.status(402).json({ error: gatewayResult.error ?? "Payment failed", paymentStatus: "failed" });
      return;
    }

    gatewayMeta = {
      gatewayId: gatewayResult.gatewayId,
      gatewayTxnId: gatewayResult.gatewayTxnId,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      utr: gatewayResult.utr,
      gatewayMode: gatewayResult.mode,
      gatewayResponse: gatewayResult,
    };
    billing.gateway = gatewayResult.gatewayId;
    billing.gatewayMode = gatewayResult.mode;
  } else if (!isCashPaymentMethod(method)) {
    // Anything that is neither cash nor a confirmed gateway charge — "wallet", "nfc",
    // an unrecognised string — used to be marked paid simply for not being cash. That
    // meant any method name at all settled the bill. Money only moves through a
    // confirmed gateway or over the counter.
    res.status(402).json({
      error: "This payment method is not available yet. Please pay at the counter.",
      paymentStatus: "pending",
    });
    return;
  }

  const receiptToken = receiptTokenFor(order) ?? newReceiptToken();

  const [updated] = await db.update(ordersTable).set({
    paymentMethod: method,
    paymentStatus,
    tipAmount: tipAmount != null ? String(parseNum(tipAmount).toFixed(2)) : order.tipAmount,
    invoiceNumber: order.invoiceNumber ?? generateInvoiceNumber(order.id, order.restaurantId),
    metadata: { ...meta, ...gatewayMeta, billing, receiptToken },
  }).where(eq(ordersTable.id, orderId)).returning();

  res.json({
    success: true,
    order: updated,
    paymentStatus,
    // The only way back to this receipt once the browser session is gone.
    receiptToken,
    receiptUrl: `/api/public/payments/invoice/${orderId}?token=${receiptToken}`,
    gateway: gatewayMeta.gatewayId ?? null,
    gatewayMode: gatewayMeta.gatewayMode ?? null,
  });
});

router.get("/public/payments/invoice/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  // An invoice carries the diner's name, phone and everything they ate. It used to be
  // fetched by id alone, so counting upward printed a GST bill for every table in the
  // venue. `?token=` is the receipt token handed back at payment, so the guest can open
  // their own bill again from a different tab, phone or day.
  const order = await loadInvoiceOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings, restaurant);
  const invoice = guestInvoice(order, restaurant?.name ?? "Restaurant", billing);

  if (!order.invoiceNumber) {
    await db.update(ordersTable).set({ invoiceNumber: invoice.invoiceNumber }).where(eq(ordersTable.id, orderId));
  }

  res.json({ invoice, html: buildInvoiceHtml(invoice) });
});

router.get("/public/payments/invoice/:orderId/download", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  // An invoice carries the diner's name, phone and everything they ate. It used to be
  // fetched by id alone, so counting upward printed a GST bill for every table in the
  // venue. `?token=` is the receipt token handed back at payment, so the guest can open
  // their own bill again from a different tab, phone or day.
  const order = await loadInvoiceOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings, restaurant);
  const invoice = guestInvoice(order, restaurant?.name ?? "Restaurant", billing);
  const html = buildInvoiceHtml(invoice);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.html"`);
  res.send(html);
});

router.get("/public/payments/invoice/:orderId/pdf", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.params.orderId), 10);
  // An invoice carries the diner's name, phone and everything they ate. It used to be
  // fetched by id alone, so counting upward printed a GST bill for every table in the
  // venue. `?token=` is the receipt token handed back at payment, so the guest can open
  // their own bill again from a different tab, phone or day.
  const order = await loadInvoiceOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings, restaurant);
  const invoice = guestInvoice(order, restaurant?.name ?? "Restaurant", billing);
  const pdf = buildInvoicePdfBuffer(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdf);
});

export default router;
