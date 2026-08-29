import { Router, type IRouter } from "express";
import { eq, and, desc, inArray, gte } from "drizzle-orm";
import { db, ordersTable, menuItemsTable, customersTable, feedbackTable, tablesMapTable, financeTransactionsTable, cashShiftsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { broadcastEvent, broadcastOrderEvent } from "../lib/sse";
import { initialTrackingMetadata } from "../lib/orderTracking.js";
import { generateInvoiceNumber, resolvePaymentStatus } from "../lib/paymentLogic.js";
import { autoAssignWaiterToOrder } from "../lib/staff-auto-assignment.js";

const router: IRouter = Router();

function parseOrder(o: any) {
  return {
    ...o,
    subtotal: parseFloat(String(o.subtotal ?? "0")),
    tax: parseFloat(String(o.tax ?? "0")),
    total: parseFloat(String(o.total ?? "0")),
    items: Array.isArray(o.items) ? o.items : [],
  };
}

router.get("/restaurants/:restaurantId/orders", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status } = req.query;
  let orders;
  if (status) {
    orders = await db.select().from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.status, status as string))).orderBy(desc(ordersTable.createdAt));
  } else {
    orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId)).orderBy(desc(ordersTable.createdAt));
  }
  res.json(orders.map(parseOrder));
});

router.get("/restaurants/:restaurantId/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(parseOrder(order));
});

router.put("/restaurants/:restaurantId/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const orderId = parseInt(req.params.orderId, 10);
  const { status, chefName, waiterName, isDelayed, delayReason, paymentMethod, paymentStatus, tipAmount,
    finalTotal, collectedBy, collectedFrom, utr, upiId } = req.body;
  const [existing] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const meta = (typeof existing.metadata === "object" && existing.metadata !== null ? existing.metadata : {}) as Record<string, unknown>;
  const tracking = (typeof meta.tracking === "object" && meta.tracking !== null ? meta.tracking : {}) as Record<string, unknown>;
  const updates = Array.isArray(tracking.kitchenUpdates) ? [...tracking.kitchenUpdates] : [];
  const now = new Date().toISOString();

  if (status && status !== existing.status) {
    const statusMessages: Record<string, string> = {
      accepted: "Order accepted by kitchen",
      confirmed: "Order confirmed",
      preparing: "Kitchen started preparing your order",
      ready: "Order ready for pickup",
      serving: "Waiter is on the way",
      delivered: "Order delivered to table",
      completed: "Order completed",
      cancelled: "Order cancelled",
      delayed: "Order marked as delayed",
    };
    if (statusMessages[status]) {
      updates.unshift({ at: now, message: statusMessages[status], type: status === "delayed" ? "delay" : "info" });
    }
    if (status === "preparing" && !tracking.chefAssignedAt) {
      tracking.chefAssignedAt = now;
      tracking.chefName = chefName ?? tracking.chefName ?? "Head Chef";
      updates.unshift({ at: now, message: `Chef ${tracking.chefName} assigned`, type: "chef" });
    }
    if (status === "preparing" || status === "ready") {
      tracking.cookingStartedAt = tracking.cookingStartedAt ?? now;
    }
    if (status === "serving") {
      tracking.waiterStatus = "on_the_way";
    }
    if (status === "delivered" || status === "completed") {
      tracking.waiterStatus = "delivered";
    }
  }
  if (isDelayed) {
    tracking.isDelayed = true;
    tracking.delayReason = delayReason ?? tracking.delayReason;
    tracking.delayMinutes = (Number(tracking.delayMinutes) || 0) + 5;
    updates.unshift({ at: now, message: delayReason ?? "Kitchen delay — order is being prioritised", type: "delay" });
  }
  if (chefName) tracking.chefName = chefName;
  tracking.kitchenUpdates = updates;

  // Capture payment detail (who collected it, from which panel, and the UPI/UTR reference)
  // on the order metadata so every panel can show a full, clickable breakdown.
  const existingPayment = (typeof meta.payment === "object" && meta.payment !== null ? meta.payment : {}) as Record<string, unknown>;
  const hasPaymentDetail = paymentMethod || paymentStatus || collectedBy || collectedFrom || utr || upiId;
  const paymentDetail = hasPaymentDetail ? {
    ...existingPayment,
    ...(paymentMethod ? { method: paymentMethod } : {}),
    ...(paymentStatus ? { status: paymentStatus } : {}),
    ...(collectedBy ? { collectedBy } : {}),
    ...(collectedFrom ? { collectedFrom } : {}),
    ...(utr ? { utr } : {}),
    ...(upiId ? { upiId } : {}),
    collectedAt: now,
  } : existingPayment;

  const orderPatch: Record<string, unknown> = {
    status: status ?? existing.status,
    waiterName: waiterName ?? existing.waiterName,
    metadata: { ...meta, tracking, ...(hasPaymentDetail ? { payment: paymentDetail } : {}) },
  };
  if (paymentMethod) orderPatch.paymentMethod = paymentMethod;
  if (paymentStatus) orderPatch.paymentStatus = paymentStatus;
  if (tipAmount !== undefined) orderPatch.tipAmount = String(tipAmount);
  // Persist the exact amount collected at the POS (incl. any discount/tip) so the order
  // total = what was collected = what every revenue view shows. Keeps subtotal+tax+tip = total.
  if (finalTotal !== undefined && finalTotal !== null && Number.isFinite(Number(finalTotal))) {
    const ft = Number(finalTotal);
    const tip = tipAmount !== undefined ? Number(tipAmount) : parseFloat(String(existing.tipAmount ?? 0)) || 0;
    const taxable = Math.max(0, ft - tip);
    const newSubtotal = taxable / 1.05;
    orderPatch.total = ft.toFixed(2);
    orderPatch.subtotal = newSubtotal.toFixed(2);
    orderPatch.tax = (taxable - newSubtotal).toFixed(2);
  }

  let [order] = await db.update(ordersTable).set(orderPatch).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Single write path: when an order first becomes paid, record it in the finance ledger
  // (so Finance / Owner / Super-admin all see the same money) and, for cash, bump the open
  // cash shift so the Cash Counter reflects real collections — not just seed data.
  const wasPaid = existing.paymentStatus === "paid" || existing.status === "completed";
  const nowPaid = order.paymentStatus === "paid" || order.status === "completed";
  if (!wasPaid && nowPaid) {
    try {
      const amount = String(parseFloat(String(order.total ?? "0")).toFixed(2));
      const method = (order.paymentMethod || paymentMethod || "cash") as string;
      // Guard against a duplicate ledger row if this transition somehow fires twice.
      const [dup] = await db.select({ id: financeTransactionsTable.id })
        .from(financeTransactionsTable)
        .where(and(eq(financeTransactionsTable.orderId, order.id), eq(financeTransactionsTable.type, "income")))
        .limit(1);
      if (!dup) {
        await db.insert(financeTransactionsTable).values({
          restaurantId,
          type: "income",
          category: "order_payment",
          description: `Order #${order.id}${order.tableName ? ` · ${order.tableName}` : ""} — ${method}`,
          amount,
          paymentMethod: method,
          reference: (utr || upiId || order.invoiceNumber || null) as string | null,
          orderId: order.id,
          performedBy: (collectedBy || collectedFrom || null) as string | null,
        });
        if (method === "cash") {
          const [shift] = await db.select().from(cashShiftsTable)
            .where(and(eq(cashShiftsTable.restaurantId, restaurantId), eq(cashShiftsTable.status, "open")))
            .orderBy(desc(cashShiftsTable.openedAt)).limit(1);
          if (shift) {
            const newSales = (parseFloat(String(shift.cashSales ?? "0")) + parseFloat(amount)).toFixed(2);
            await db.update(cashShiftsTable).set({ cashSales: newSales }).where(eq(cashShiftsTable.id, shift.id));
          }
        }
      }
    } catch (e) {
      // Never fail the order update because the ledger write hit a snag.
      console.error("finance ledger write failed for order", order.id, e);
    }
  }

  if (status === "ready" && !order.waiterName) {
    const auto = await autoAssignWaiterToOrder(restaurantId, orderId);
    if (auto) order = auto;
  }
  if (order.tableId) {
    const tableStatus = status === "billing" ? "billing" : ["delivered", "completed", "cancelled"].includes(status) ? "free" : "occupied";
    const tableUpdate: Record<string, unknown> = { status: tableStatus };
    if (tableStatus === "free") {
      tableUpdate.currentOrderId = null;
      tableUpdate.currentCustomerName = null;
      tableUpdate.currentGuestCount = 0;
      tableUpdate.occupiedSince = null;
    } else if (status === "billing") {
      tableUpdate.status = "billing";
    }
    await db.update(tablesMapTable).set(tableUpdate).where(and(eq(tablesMapTable.id, order.tableId), eq(tablesMapTable.restaurantId, restaurantId)));
  }
  broadcastEvent("order_status", { id: order.id, tableName: order.tableName, status });
  broadcastOrderEvent(order.id, "order_status", { id: order.id, status, tableName: order.tableName });
  res.json(parseOrder(order));
});

router.post("/public/orders", async (req, res): Promise<void> => {
  const {
    restaurantId, tableId, tableName, customerName, customerPhone, customerEmail, type, items, notes,
    deliveryAddress, paymentMethod, tipAmount, discountAmount, couponCode, guestCount, metadata,
    scheduledAt, splitPayments, partialPayNow, advanceAmount, nfcTagId, qrCodeId,
  } = req.body;
  if (!restaurantId || !items || !Array.isArray(items)) { res.status(400).json({ error: "restaurantId and items required" }); return; }

  const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
  const menuMap = new Map(menuItems.map(m => [m.id, m]));

  let subtotal = 0;
  const orderItems: any[] = [];
  for (const item of items) {
    const mi = menuMap.get(item.menuItemId);
    if (!mi) { res.status(400).json({ error: `Menu item ${item.menuItemId} not found` }); return; }
    const price = item.unitPrice != null ? parseFloat(String(item.unitPrice)) : parseFloat(String(mi.discountedPrice || mi.price));
    const addonTotal = Array.isArray(item.addons) ? item.addons.reduce((s: number, a: any) => s + parseFloat(String(a.price ?? 0)), 0) : 0;
    const lineTotal = (price + addonTotal) * item.quantity;
    subtotal += lineTotal;
    orderItems.push({ id: mi.id, menuItemId: mi.id, name: mi.name, price, quantity: item.quantity, variant: item.variant, addons: item.addons, notes: item.notes, customizations: item.customizations, course: item.course, subtotal: lineTotal });
  }

  const discount = parseFloat(String(discountAmount ?? 0));
  const tax = parseFloat(((subtotal - discount) * 0.05).toFixed(2));
  const tip = parseFloat(String(tipAmount ?? 0));
  const total = subtotal - discount + tax + tip;

  const prepMinutes = Math.min(45, Math.max(15, orderItems.reduce((s, i) => s + (i.quantity ?? 1) * 5, 10)));
  const baseMeta = typeof metadata === "object" && metadata !== null ? metadata : {};
  const roomFromTable = tableName?.match(/room\s+(\S+)/i)?.[1];
  const enrichedMeta = {
    ...baseMeta,
    ...(roomFromTable ? { roomNumber: roomFromTable } : {}),
    ...((type === "room_service" || roomFromTable) && !baseMeta.roomNumber && roomFromTable
      ? { roomNumber: roomFromTable }
      : {}),
  };
  const trackingMeta = initialTrackingMetadata(prepMinutes);

  const billingMeta: Record<string, unknown> = {
    couponCode: couponCode ?? null,
    splitPayment: Array.isArray(splitPayments) && splitPayments.length
      ? { enabled: true, splits: splitPayments }
      : baseMeta.splitBilling ?? null,
    partialPayment: partialPayNow != null && partialPayNow < total
      ? { enabled: true, payNow: parseFloat(String(partialPayNow)), remaining: total - parseFloat(String(partialPayNow)) }
      : null,
    advancePayment: advanceAmount != null && advanceAmount < total
      ? { enabled: true, advanceAmount: parseFloat(String(advanceAmount)), balanceDue: total - parseFloat(String(advanceAmount)) }
      : null,
  };

  const paymentStatus = resolvePaymentStatus(paymentMethod ?? "upi", {
    partialPayNow: partialPayNow != null ? parseFloat(String(partialPayNow)) : undefined,
    advanceAmount: advanceAmount != null ? parseFloat(String(advanceAmount)) : undefined,
    grandTotal: total,
  });

  // Running tab: if this table already has an OPEN (unbilled) order, append the new items
  // to it instead of creating a separate order — so the guest keeps ONE order + one bill.
  // Only for seated dine-in / room orders; takeaway & delivery stay separate.
  const OPEN_STATUSES = ["new", "pending", "accepted", "confirmed", "preparing", "ready", "served"];
  const isSeated = (type ?? "dine_in") === "dine_in" || String(type ?? "").includes("room");
  // Only merge into a tab that's still ACTIVE (touched within this window). A table left
  // idle longer than this is treated as a new guest → fresh order, not merged into the
  // previous party's stale tab. Configurable via ORDER_MERGE_WINDOW_MIN (default 120 min).
  const MERGE_WINDOW_MS = (parseInt(process.env.ORDER_MERGE_WINDOW_MIN ?? "120", 10) || 120) * 60 * 1000;
  if (isSeated && tableName) {
    const [openOrder] = await db.select().from(ordersTable)
      .where(and(
        eq(ordersTable.restaurantId, restaurantId),
        eq(ordersTable.tableName, tableName),
        inArray(ordersTable.status, OPEN_STATUSES),
        gte(ordersTable.updatedAt, new Date(Date.now() - MERGE_WINDOW_MS)),
      ))
      .orderBy(desc(ordersTable.createdAt)).limit(1);
    if (openOrder) {
      const prevItems = Array.isArray(openOrder.items) ? (openOrder.items as any[]) : [];
      const mergedItems = [...prevItems, ...orderItems];
      const mergedSubtotal = parseFloat(String(openOrder.subtotal || 0)) + subtotal;
      const mergedTax = parseFloat(String(openOrder.tax || 0)) + tax;
      const mergedTotal = parseFloat(String(openOrder.total || 0)) + subtotal + tax;
      // If the order was already finished, bump it back so the kitchen makes the new round.
      const bumped = ["ready", "served"].includes(String(openOrder.status)) ? "pending" : openOrder.status;
      const [updated] = await db.update(ordersTable).set({
        items: mergedItems,
        subtotal: String(mergedSubtotal.toFixed(2)),
        tax: String(mergedTax.toFixed(2)),
        total: String(mergedTotal.toFixed(2)),
        status: bumped,
      }).where(eq(ordersTable.id, openOrder.id)).returning();
      for (const item of items) {
        const mi = menuMap.get(item.menuItemId);
        if (mi) await db.update(menuItemsTable).set({ orderCount: mi.orderCount + item.quantity }).where(eq(menuItemsTable.id, mi.id));
      }
      broadcastEvent("order_updated", { id: updated.id, restaurantId, tableName, total: mergedTotal, status: bumped, appended: true });
      broadcastOrderEvent(updated.id, "order_status", { id: updated.id, status: bumped, tableName });
      res.status(200).json(parseOrder(updated));
      return;
    }
  }

  const [order] = await db.insert(ordersTable).values({
    restaurantId, tableId: tableId ?? null, tableName: tableName ?? null,
    customerName: customerName ?? null, customerPhone: customerPhone ?? null, customerEmail: customerEmail ?? null,
    type: type ?? "dine_in", status: "pending", items: orderItems,
    subtotal: String(subtotal.toFixed(2)), tax: String(tax), total: String(total.toFixed(2)),
    notes: notes ?? null, deliveryAddress: deliveryAddress ?? null,
    paymentMethod: paymentMethod ?? null,
    paymentStatus,
    tipAmount: String(tip.toFixed(2)),
    discountAmount: String(discount.toFixed(2)),
    guestCount: guestCount ?? 1,
    orderSource: "user_web",
    nfcTagId: nfcTagId ?? null,
    qrCodeId: qrCodeId ?? null,
    metadata: { ...enrichedMeta, ...trackingMeta, billing: billingMeta },
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  }).returning();

  await db.update(ordersTable).set({
    invoiceNumber: generateInvoiceNumber(order.id, restaurantId),
  }).where(eq(ordersTable.id, order.id));

  for (const item of items) {
    const mi = menuMap.get(item.menuItemId);
    if (mi) await db.update(menuItemsTable).set({ orderCount: mi.orderCount + item.quantity }).where(eq(menuItemsTable.id, mi.id));
  }

  if (customerPhone || customerEmail) {
    const existing = await db.select().from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
    const found = existing.find(c => (customerPhone && c.phone === customerPhone) || (customerEmail && c.email === customerEmail));
    if (found) {
      await db.update(customersTable).set({
        totalOrders: found.totalOrders + 1,
        totalSpend: String((parseFloat(String(found.totalSpend)) + total).toFixed(2)),
        lastVisit: new Date(),
        segment: found.totalOrders + 1 >= 10 ? "vip" : found.totalOrders + 1 >= 3 ? "regular" : "new",
      }).where(eq(customersTable.id, found.id));
    } else {
      await db.insert(customersTable).values({
        restaurantId, name: customerName ?? null, phone: customerPhone ?? null, email: customerEmail ?? null,
        totalOrders: 1, totalSpend: String(total.toFixed(2)), lastVisit: new Date(), segment: "new",
      });
    }
  }

  if (tableId) {
    await db.update(tablesMapTable).set({
      status: "occupied",
      currentOrderId: order.id,
      currentCustomerName: customerName ?? null,
      currentGuestCount: req.body.guestCount ?? 1,
      occupiedSince: new Date(),
    }).where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)));
  }

  broadcastEvent("new_order", { id: order.id, restaurantId, tableName, total, status: "pending" });
  broadcastOrderEvent(order.id, "order_status", { id: order.id, status: "pending", tableName });
  res.status(201).json(parseOrder({ ...order, invoiceNumber: generateInvoiceNumber(order.id, restaurantId) }));
});

// Live-edit a still-open order from the guest menu: +1 / -1 a plain (un-customized) item.
// Only while the order is not yet prepared/billed. Recomputes totals so the bill stays exact.
router.post("/public/orders/:orderId/adjust-item", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const { menuItemId, delta } = req.body;
  const d = parseInt(String(delta), 10);
  if (Number.isNaN(orderId) || !menuItemId || !d) { res.status(400).json({ error: "orderId, menuItemId and delta required" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const OPEN = ["new", "pending", "accepted", "confirmed", "preparing"];
  if (!OPEN.includes(String(order.status))) { res.status(409).json({ error: "Order can no longer be changed — it's already prepared or billed." }); return; }

  const items = Array.isArray(order.items) ? [...(order.items as any[])] : [];
  const isPlain = (i: any) => (i.menuItemId === menuItemId || i.id === menuItemId) && (!i.customizations || i.customizations.length === 0) && (!i.addons || i.addons.length === 0) && !i.variant;
  const idx = items.findIndex(isPlain);
  if (idx >= 0) {
    const it = items[idx];
    const unit = parseFloat(String(it.price)) || 0;
    const newQty = (it.quantity ?? it.qty ?? 1) + d;
    if (newQty <= 0) items.splice(idx, 1);
    else items[idx] = { ...it, quantity: newQty, qty: newQty, subtotal: unit * newQty };
  } else if (d > 0) {
    const [mi] = await db.select().from(menuItemsTable).where(and(eq(menuItemsTable.id, menuItemId), eq(menuItemsTable.restaurantId, order.restaurantId)));
    if (!mi) { res.status(400).json({ error: "Menu item not found" }); return; }
    const unit = parseFloat(String(mi.discountedPrice || mi.price)) || 0;
    items.push({ id: mi.id, menuItemId: mi.id, name: mi.name, price: unit, quantity: d, qty: d, subtotal: unit * d });
  } else {
    res.status(400).json({ error: "Item not in order" }); return;
  }

  const subtotal = Math.round(items.reduce((s, i) => s + (parseFloat(String(i.subtotal)) || (parseFloat(String(i.price)) || 0) * (i.quantity ?? i.qty ?? 1)), 0) * 100) / 100;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const [updated] = await db.update(ordersTable).set({
    items, subtotal: String(subtotal.toFixed(2)), tax: String(tax.toFixed(2)), total: String(total.toFixed(2)),
  }).where(eq(ordersTable.id, orderId)).returning();
  broadcastEvent("order_updated", { id: orderId, restaurantId: order.restaurantId, tableName: order.tableName, total, status: order.status });
  broadcastOrderEvent(orderId, "order_status", { id: orderId, status: order.status, tableName: order.tableName });
  res.json(parseOrder(updated));
});

router.post("/public/orders/reorder/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  if (Number.isNaN(orderId)) { res.status(400).json({ error: "Invalid order ID" }); return; }
  const [original] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!original) { res.status(404).json({ error: "Order not found" }); return; }

  const items = Array.isArray(original.items) ? original.items as Record<string, unknown>[] : [];
  if (!items.length) { res.status(400).json({ error: "Order has no items to reorder" }); return; }

  const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, original.restaurantId));
  const menuMap = new Map(menuItems.map(m => [m.id, m]));
  let subtotal = 0;
  const orderItems: Record<string, unknown>[] = [];
  for (const item of items) {
    const menuItemId = Number(item.menuItemId ?? item.id);
    const mi = menuMap.get(menuItemId);
    if (!mi) continue;
    const qty = Number(item.quantity ?? 1);
    const price = parseFloat(String(mi.discountedPrice || mi.price));
    const lineTotal = price * qty;
    subtotal += lineTotal;
    orderItems.push({
      id: mi.id, menuItemId: mi.id, name: mi.name, price, quantity: qty,
      variant: item.variant, addons: item.addons, notes: item.notes, course: item.course ?? "main", subtotal: lineTotal,
    });
  }
  if (!orderItems.length) { res.status(400).json({ error: "Menu items no longer available" }); return; }

  const tax = parseFloat((subtotal * 0.05).toFixed(2));
  const total = subtotal + tax;
  const prepMinutes = Math.min(45, Math.max(15, orderItems.reduce((s, i) => s + (Number(i.quantity) ?? 1) * 5, 10)));

  const [order] = await db.insert(ordersTable).values({
    restaurantId: original.restaurantId,
    tableId: original.tableId,
    tableName: req.body.tableName ?? original.tableName,
    customerName: original.customerName,
    customerPhone: original.customerPhone,
    customerEmail: original.customerEmail,
    type: original.type,
    status: "pending",
    items: orderItems,
    subtotal: String(subtotal.toFixed(2)),
    tax: String(tax),
    total: String(total.toFixed(2)),
    notes: `Reorder from #${orderId}`,
    paymentMethod: req.body.paymentMethod ?? original.paymentMethod,
    guestCount: original.guestCount,
    orderSource: "user_web",
    metadata: { ...initialTrackingMetadata(prepMinutes), reorderFrom: orderId },
  }).returning();

  broadcastEvent("new_order", { id: order.id, restaurantId: original.restaurantId, tableName: order.tableName, total, status: "pending" });
  broadcastOrderEvent(order.id, "order_status", { id: order.id, status: "pending", tableName: order.tableName });
  res.status(201).json({ ...parseOrder(order), reorderFrom: orderId, message: "Order placed again!" });
});

router.get("/public/orders/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(parseOrder(order));
});

router.post("/public/feedback", async (req, res): Promise<void> => {
  const { restaurantId, orderId, customerName, rating, foodRating, serviceRating, ambienceRating, comment } = req.body;
  if (!restaurantId || !rating) { res.status(400).json({ error: "restaurantId and rating required" }); return; }
  const [fb] = await db.insert(feedbackTable).values({ restaurantId, orderId, customerName, rating, foodRating, serviceRating, ambienceRating, comment }).returning();
  res.status(201).json(fb);
});

export default router;
