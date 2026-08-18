import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, restaurantsTable } from "@workspace/db";
import {
  getPaymentCatalog, computeBillQuote, buildGstInvoice, buildInvoiceHtml,
  generateInvoiceNumber, validateSplitPayments, resolvePaymentStatus,
} from "../lib/paymentLogic.js";
import { buildInvoicePdfBuffer } from "../lib/invoicePdf.js";
import { billingFromSettings } from "../lib/restaurant-catalogs.js";
import { getPlatformSettingsRaw } from "../lib/platform-admin.js";
import { getPaymentsPublicConfig, isOnlinePaymentMethod, isCashPaymentMethod, processGatewayPayment } from "../lib/payment-gateway.js";

const router: IRouter = Router();

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

function payAmountForOrder(grandTotal: number, body: Record<string, unknown>): number {
  if (body.partialPayNow != null) return parseNum(body.partialPayNow);
  if (body.advanceAmount != null) return parseNum(body.advanceAmount);
  return grandTotal;
}

router.get("/public/payments/catalog", async (_req, res) => {
  const settings = await getPlatformSettingsRaw();
  const payments = getPaymentsPublicConfig(settings.integrations);
  res.json({
    ...getPaymentCatalog(),
    ...payments,
  });
});

router.post("/public/payments/quote", (req, res) => {
  const { subtotal, discount, tip, splitCount, partialPayNow, advanceAmount } = req.body;
  if (subtotal == null) { res.status(400).json({ error: "subtotal required" }); return; }
  res.json(computeBillQuote({
    subtotal: parseNum(subtotal),
    discount: parseNum(discount),
    tip: parseNum(tip),
    splitCount: splitCount ? parseInt(String(splitCount), 10) : undefined,
    partialPayNow: partialPayNow != null ? parseNum(partialPayNow) : undefined,
    advanceAmount: advanceAmount != null ? parseNum(advanceAmount) : undefined,
  }));
});

router.post("/public/payments/intent/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
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
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
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
    // Wallet and other in-app methods — mark paid when not cash
    paymentStatus = resolvePaymentStatus(method, {
      partialPayNow: partialPayNow != null ? parseNum(partialPayNow) : undefined,
      advanceAmount: advanceAmount != null ? parseNum(advanceAmount) : undefined,
      grandTotal,
    });
  }

  const [updated] = await db.update(ordersTable).set({
    paymentMethod: method,
    paymentStatus,
    tipAmount: tipAmount != null ? String(parseNum(tipAmount).toFixed(2)) : order.tipAmount,
    invoiceNumber: order.invoiceNumber ?? generateInvoiceNumber(order.id, order.restaurantId),
    metadata: { ...meta, ...gatewayMeta, billing },
  }).where(eq(ordersTable.id, orderId)).returning();

  res.json({
    success: true,
    order: updated,
    paymentStatus,
    gateway: gatewayMeta.gatewayId ?? null,
    gatewayMode: gatewayMeta.gatewayMode ?? null,
  });
});

router.get("/public/payments/invoice/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings);
  const invoice = buildGstInvoice(order, restaurant?.name ?? "Restaurant", billing);

  if (!order.invoiceNumber) {
    await db.update(ordersTable).set({ invoiceNumber: invoice.invoiceNumber }).where(eq(ordersTable.id, orderId));
  }

  res.json({ invoice, html: buildInvoiceHtml(invoice) });
});

router.get("/public/payments/invoice/:orderId/download", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings);
  const invoice = buildGstInvoice(order, restaurant?.name ?? "Restaurant", billing);
  const html = buildInvoiceHtml(invoice);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.html"`);
  res.send(html);
});

router.get("/public/payments/invoice/:orderId/pdf", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId));
  const settings = (restaurant?.settings && typeof restaurant.settings === "object" ? restaurant.settings : {}) as Record<string, unknown>;
  const billing = billingFromSettings(settings);
  const invoice = buildGstInvoice(order, restaurant?.name ?? "Restaurant", billing);
  const pdf = buildInvoicePdfBuffer(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdf);
});

export default router;
