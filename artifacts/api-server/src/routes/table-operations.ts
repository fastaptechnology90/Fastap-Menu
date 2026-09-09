import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, ordersTable, tablesMapTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { taxForOrderItems, round2 } from "../lib/order-pricing.js";
import { broadcastEvent } from "../lib/sse.js";
import { logger } from "../lib/logger.js";

/**
 * Moving a tab and splitting a bill — two things a floor does constantly, neither of
 * which existed.
 *
 * A party that moves from the bar to a table, or asks to pay separately, had no path
 * through the product at all. The only workaround was to cancel and re-key the order,
 * which loses the kitchen's timing and the original timestamps, or to edit the collected
 * total by hand, which loses any record of what happened.
 */

const router: IRouter = Router();

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

type OrderItem = { name?: string; subtotal?: number; voided?: boolean; comped?: boolean; [k: string]: unknown };

/** Recompute money from the lines that still count, taxing each at its own treatment. */
async function totalsFor(restaurantId: number, items: OrderItem[], discount = 0, tip = 0) {
  const billable = items.filter(i => !i.voided && !i.comped);
  const subtotal = round2(billable.reduce((t, i) => t + num(i.subtotal), 0));
  const breakdown = await taxForOrderItems(restaurantId, billable as { subtotal?: unknown; taxCategory?: string | null }[], discount);
  const taxable = Math.max(0, round2(subtotal - discount));
  return { subtotal, tax: breakdown.tax, total: round2(taxable + breakdown.tax + tip), breakdown };
}

/**
 * Move a running tab to a different table. The old table is released and the new one
 * takes on the order, so the floor map matches reality rather than showing a party that
 * has already moved.
 */
router.post("/restaurants/:restaurantId/orders/:orderId/move-table", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const { tableId, tableName } = req.body ?? {};

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (["completed", "cancelled"].includes(String(order.status))) {
    res.status(409).json({ error: "A settled order cannot be moved." });
    return;
  }

  const target = tableId
    ? (await db.select().from(tablesMapTable)
        .where(and(eq(tablesMapTable.id, Number(tableId)), eq(tablesMapTable.restaurantId, restaurantId))))[0]
    : (await db.select().from(tablesMapTable)
        .where(and(eq(tablesMapTable.name, String(tableName ?? "")), eq(tablesMapTable.restaurantId, restaurantId))))[0];

  if (!target) { res.status(404).json({ error: "That table does not exist at this venue." }); return; }
  if (target.currentOrderId && target.currentOrderId !== orderId) {
    res.status(409).json({ error: `${target.name} already has an open order. Merge the tabs instead.` });
    return;
  }

  if (order.tableId && order.tableId !== target.id) {
    await db.update(tablesMapTable).set({
      status: "free", currentOrderId: null, currentCustomerName: null,
      currentGuestCount: 0, occupiedSince: null,
    }).where(and(eq(tablesMapTable.id, order.tableId), eq(tablesMapTable.restaurantId, restaurantId)));
  }

  await db.update(tablesMapTable).set({
    status: "occupied",
    currentOrderId: orderId,
    currentCustomerName: order.customerName,
    currentGuestCount: order.guestCount ?? 1,
    occupiedSince: target.occupiedSince ?? new Date(),
  }).where(eq(tablesMapTable.id, target.id));

  const [updated] = await db.update(ordersTable)
    .set({ tableId: target.id, tableName: target.name })
    .where(eq(ordersTable.id, orderId)).returning();

  logger.info({ restaurantId, orderId, from: order.tableName, to: target.name }, "tab moved between tables");
  broadcastEvent("order_updated", { id: orderId, restaurantId, tableName: target.name });
  res.json({ order: updated, movedFrom: order.tableName, movedTo: target.name });
});

/**
 * Split a bill. Named lines move to a new order that keeps the same table, so the kitchen
 * is unaffected and each party pays for what they had. Splitting evenly by headcount is a
 * payment-time concern and does not belong here — this divides the bill itself.
 */
router.post("/restaurants/:restaurantId/orders/:orderId/split", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const orderId = parseInt(String(req.params.orderId), 10);
  const { itemIndexes } = req.body ?? {};

  if (!Array.isArray(itemIndexes) || itemIndexes.length === 0) {
    res.status(400).json({ error: "Name the lines to move out, as itemIndexes." });
    return;
  }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.paymentStatus === "paid") {
    res.status(409).json({ error: "This bill has already been settled." });
    return;
  }

  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  const wanted = [...new Set(itemIndexes.map(Number))].sort((a, b) => a - b);
  if (wanted.some(i => !Number.isInteger(i) || i < 0 || i >= items.length)) {
    res.status(400).json({ error: "itemIndexes does not match the lines on this order." });
    return;
  }
  if (wanted.length === items.length) {
    res.status(400).json({ error: "That would move every line — there would be nothing left to split from." });
    return;
  }

  const moved = wanted.map(i => items[i]);
  const kept = items.filter((_, i) => !wanted.includes(i));

  // The discount and tip stay with the original bill rather than being divided, since
  // neither was agreed per line and guessing a split would misstate both.
  const keptTotals = await totalsFor(restaurantId, kept, num(order.discountAmount), num(order.tipAmount));
  const movedTotals = await totalsFor(restaurantId, moved);

  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;

  const [child] = await db.insert(ordersTable).values({
    restaurantId,
    tableId: order.tableId,
    tableName: order.tableName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    type: order.type,
    status: order.status,
    items: moved,
    subtotal: movedTotals.subtotal.toFixed(2),
    tax: movedTotals.tax.toFixed(2),
    total: movedTotals.total.toFixed(2),
    paymentStatus: "pending",
    waiterName: order.waiterName,
    guestCount: 1,
    orderSource: order.orderSource,
    metadata: { ...meta, splitFrom: orderId, splitAt: new Date().toISOString() },
  }).returning();

  const [parent] = await db.update(ordersTable).set({
    items: kept,
    subtotal: keptTotals.subtotal.toFixed(2),
    tax: keptTotals.tax.toFixed(2),
    total: keptTotals.total.toFixed(2),
    metadata: { ...meta, splitInto: [...(Array.isArray(meta.splitInto) ? meta.splitInto : []), child.id] },
  }).where(eq(ordersTable.id, orderId)).returning();

  logger.info({ restaurantId, orderId, childId: child.id, lines: wanted.length }, "bill split");
  broadcastEvent("order_updated", { id: orderId, restaurantId });
  res.status(201).json({ original: parent, split: child });
});

/**
 * Merge two tabs into one — the reverse of a split, and what happens when two tables are
 * pushed together. Lines move onto the target order and the source is cancelled so it
 * cannot be billed twice.
 */
router.post("/restaurants/:restaurantId/orders/merge", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { intoOrderId, fromOrderIds } = req.body ?? {};

  if (!intoOrderId || !Array.isArray(fromOrderIds) || fromOrderIds.length === 0) {
    res.status(400).json({ error: "intoOrderId and fromOrderIds are required." });
    return;
  }

  const ids = [Number(intoOrderId), ...fromOrderIds.map(Number)];
  const rows = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.restaurantId, restaurantId), inArray(ordersTable.id, ids)));

  const target = rows.find(o => o.id === Number(intoOrderId));
  const sources = rows.filter(o => o.id !== Number(intoOrderId));
  if (!target || sources.length !== fromOrderIds.length) {
    res.status(404).json({ error: "One or more of those orders is not at this venue." });
    return;
  }
  if (rows.some(o => o.paymentStatus === "paid")) {
    res.status(409).json({ error: "One of these bills has already been settled." });
    return;
  }

  const items = [
    ...((Array.isArray(target.items) ? target.items : []) as OrderItem[]),
    ...sources.flatMap(o => (Array.isArray(o.items) ? o.items : []) as OrderItem[]),
  ];
  const totals = await totalsFor(restaurantId, items, num(target.discountAmount), num(target.tipAmount));

  const [merged] = await db.update(ordersTable).set({
    items,
    subtotal: totals.subtotal.toFixed(2),
    tax: totals.tax.toFixed(2),
    total: totals.total.toFixed(2),
    guestCount: rows.reduce((t, o) => t + (o.guestCount ?? 1), 0),
  }).where(eq(ordersTable.id, target.id)).returning();

  for (const source of sources) {
    await db.update(ordersTable)
      .set({ status: "cancelled", cancelledReason: `Merged into order ${target.id}` })
      .where(eq(ordersTable.id, source.id));
    if (source.tableId) {
      await db.update(tablesMapTable).set({
        status: "free", currentOrderId: null, currentCustomerName: null,
        currentGuestCount: 0, occupiedSince: null,
      }).where(eq(tablesMapTable.id, source.tableId));
    }
  }

  logger.info({ restaurantId, into: target.id, from: sources.map(s => s.id) }, "tabs merged");
  broadcastEvent("order_updated", { id: target.id, restaurantId });
  res.json({ order: merged, mergedFrom: sources.map(s => s.id) });
});

export default router;
