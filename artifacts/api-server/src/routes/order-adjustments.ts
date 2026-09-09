import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { recordOrderRefundInLedger } from "../lib/order-payment-ledger.js";
import { restoreStockForOrder } from "../lib/stock-consumption.js";
import { taxForOrderItems, round2 } from "../lib/order-pricing.js";
import { broadcastEvent, broadcastOrderEvent } from "../lib/sse.js";
import { logger } from "../lib/logger.js";

/**
 * The corrections a restaurant makes every day, none of which existed.
 *
 * A bill could be raised and never adjusted: an item sent by mistake could not be voided,
 * a dish comped after a complaint could not be recorded, and there was no refund path
 * anywhere in the product. Staff worked around it by editing the collected total, which
 * left no trace of what was actually removed or why.
 *
 * Every adjustment here does three things: recalculates the order from its remaining
 * lines, writes down who did it and why, and reverses the ledger where money had already
 * been taken. An adjustment with no reason attached is indistinguishable from theft, so
 * the reason is required.
 */

const router: IRouter = Router();

type OrderItem = {
  id?: number;
  menuItemId?: number;
  name?: string;
  price?: number;
  quantity?: number;
  subtotal?: number;
  voided?: boolean;
  comped?: boolean;
  [key: string]: unknown;
};

function itemsOf(order: typeof ordersTable.$inferSelect): OrderItem[] {
  return Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
}

/** Lines that still count towards the bill — voided and comped ones do not. */
function billableTotal(items: OrderItem[]): number {
  return round2(items.reduce((sum, i) => (i.voided || i.comped ? sum : sum + Number(i.subtotal ?? 0)), 0));
}

function actorOf(req: { session: { staffSession?: { staffName?: string; staffId?: string } } }): string {
  return req.session.staffSession?.staffName
    ?? req.session.staffSession?.staffId
    ?? "staff";
}

/**
 * Recompute an order's money from whatever lines still count, and record the adjustment
 * on its metadata so the reason and the person survive alongside the numbers.
 */
async function applyAdjustment(
  restaurantId: number,
  order: typeof ordersTable.$inferSelect,
  items: OrderItem[],
  entry: Record<string, unknown>,
) {
  const wasSettled = order.paymentStatus === "paid" || order.status === "completed";
  const totalBefore = parseFloat(String(order.total ?? 0)) || 0;
  const subtotal = billableTotal(items);
  const discount = parseFloat(String(order.discountAmount ?? 0)) || 0;
  const tip = parseFloat(String(order.tipAmount ?? 0)) || 0;
  const taxable = Math.max(0, round2(subtotal - discount));
  // Same tax function the order was priced with, so voiding a line cannot move the total
  // by a rounding paisa, and a comped whisky is still not taxed as food.
  const billableLines = items.filter(i => !i.voided && !i.comped) as { subtotal?: unknown; taxCategory?: string | null }[];
  const tax = (await taxForOrderItems(restaurantId, billableLines, discount)).tax;
  const total = round2(taxable + tax + tip);

  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const history = Array.isArray(meta.adjustments) ? meta.adjustments : [];

  const [updated] = await db.update(ordersTable).set({
    items,
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    metadata: { ...meta, adjustments: [...history, entry] },
  }).where(and(eq(ordersTable.id, order.id), eq(ordersTable.restaurantId, restaurantId))).returning();

  // Voiding or comping a line on a bill that was ALREADY settled takes money off a total
  // the guest has paid. That used to rewrite the order silently: the income row kept the
  // original amount, so the order said one thing and Finance said another, and nobody was
  // ever handed the difference. Book it as a refund so the two agree again.
  if (wasSettled && updated) {
    const given = Math.round((totalBefore - (parseFloat(String(updated.total ?? 0)) || 0)) * 100) / 100;
    if (given > 0) {
      await recordOrderRefundInLedger({
        restaurantId, order: updated, amount: given,
        reason: String(entry.reason ?? ""),
        what: `line ${entry.type === "comp" ? "comped" : "voided"} after payment`,
      });
    }
  }

  return updated;
}

/** Void a line — sent by mistake, wrong table, keyed twice. It leaves the bill entirely. */
router.post("/restaurants/:restaurantId/orders/:orderId/void-item", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const { itemIndex, reason } = req.body ?? {};

  if (!reason || !String(reason).trim()) {
    res.status(400).json({ error: "A reason is required to void an item." });
    return;
  }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "cancelled") { res.status(409).json({ error: "This order is already cancelled." }); return; }

  const items = itemsOf(order);
  const idx = Number(itemIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
    res.status(400).json({ error: "itemIndex does not match a line on this order." });
    return;
  }
  if (items[idx].voided) { res.status(409).json({ error: "That line is already voided." }); return; }

  const line = items[idx];
  items[idx] = { ...line, voided: true, voidReason: String(reason).trim(), voidedBy: actorOf(req), voidedAt: new Date().toISOString() };

  const updated = await applyAdjustment(restaurantId, order, items, {
    type: "void", item: line.name, amount: Number(line.subtotal ?? 0),
    reason: String(reason).trim(), by: actorOf(req), at: new Date().toISOString(),
  });

  logger.info({ restaurantId, orderId, item: line.name, by: actorOf(req) }, "order line voided");
  broadcastEvent("order_updated", { id: orderId, restaurantId });
  broadcastOrderEvent(orderId, "order_updated", { id: orderId });
  res.json(updated);
});

/** Comp a line — given free after a complaint. The kitchen still made it, so it stays visible. */
router.post("/restaurants/:restaurantId/orders/:orderId/comp-item", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const { itemIndex, reason } = req.body ?? {};

  if (!reason || !String(reason).trim()) {
    res.status(400).json({ error: "A reason is required to comp an item." });
    return;
  }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const items = itemsOf(order);
  const idx = Number(itemIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
    res.status(400).json({ error: "itemIndex does not match a line on this order." });
    return;
  }
  if (items[idx].comped) { res.status(409).json({ error: "That line is already comped." }); return; }

  const line = items[idx];
  items[idx] = { ...line, comped: true, compReason: String(reason).trim(), compedBy: actorOf(req), compedAt: new Date().toISOString() };

  const updated = await applyAdjustment(restaurantId, order, items, {
    type: "comp", item: line.name, amount: Number(line.subtotal ?? 0),
    reason: String(reason).trim(), by: actorOf(req), at: new Date().toISOString(),
  });

  logger.info({ restaurantId, orderId, item: line.name, by: actorOf(req) }, "order line comped");
  res.json(updated);
});

/**
 * Refund money already collected — in full or in part. The ledger reversal only runs for
 * a full refund, because a partial one leaves the order genuinely part-paid and the
 * finance rows should still reflect what was kept.
 */
router.post("/restaurants/:restaurantId/orders/:orderId/refund", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const { amount, reason } = req.body ?? {};

  if (!reason || !String(reason).trim()) {
    res.status(400).json({ error: "A reason is required to refund." });
    return;
  }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const paid = order.paymentStatus === "paid" || order.status === "completed";
  if (!paid) { res.status(409).json({ error: "Nothing has been collected on this order yet." }); return; }

  const total = parseFloat(String(order.total ?? 0)) || 0;
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const already = Number((meta.refund as { total?: number } | undefined)?.total ?? 0);

  const requested = amount === undefined || amount === null ? total - already : Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    res.status(400).json({ error: "Refund amount must be greater than zero." });
    return;
  }
  if (round2(already + requested) > round2(total)) {
    res.status(400).json({
      error: `Cannot refund ₹${requested.toFixed(2)} — only ₹${(total - already).toFixed(2)} of this order remains refundable.`,
    });
    return;
  }

  const refundedTotal = round2(already + requested);
  const full = refundedTotal >= round2(total);
  const history = Array.isArray(meta.adjustments) ? meta.adjustments : [];
  const entry = {
    type: "refund", amount: round2(requested), reason: String(reason).trim(),
    by: actorOf(req), at: new Date().toISOString(), full,
  };

  const [updated] = await db.update(ordersTable).set({
    paymentStatus: full ? "refunded" : "partially_refunded",
    metadata: {
      ...meta,
      adjustments: [...history, entry],
      refund: { total: refundedTotal, lastReason: String(reason).trim(), lastAt: entry.at },
    },
  }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();

  // Every refund reaches the ledger, not only a full one. The old rule — "a partial one
  // leaves the order genuinely part-paid, so the finance rows should still reflect what was
  // kept" — did not hold: the income row still carried the whole amount, so what was handed
  // back stayed booked as income and the drawer came up short against Finance.
  await recordOrderRefundInLedger({
    restaurantId, order, amount: round2(requested), reason: String(reason).trim(),
    what: full ? "refunded in full" : "part refunded",
  });
  if (full) {
    await restoreStockForOrder(restaurantId, orderId);
  }

  logger.info({ restaurantId, orderId, amount: requested, full, by: actorOf(req) }, "order refunded");
  broadcastEvent("order_updated", { id: orderId, restaurantId });
  res.json({ order: updated, refunded: round2(requested), refundedTotal, full });
});

/** Every adjustment made to an order, so a manager can see what was changed and by whom. */
router.get("/restaurants/:restaurantId/orders/:orderId/adjustments", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  res.json({ adjustments: Array.isArray(meta.adjustments) ? meta.adjustments : [] });
});

export default router;
