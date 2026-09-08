import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, suppliersTable, purchaseOrdersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { taxRateFor, round2 } from "../lib/order-pricing.js";

const router: IRouter = Router();

/**
 * What a supplier has actually been billed comes from that supplier's purchase orders.
 * The panel had no such figure to read, so it showed the outstanding balance scaled up
 * by a constant — a number that moved when a payment was made and had nothing to do
 * with what was ever bought.
 *
 * `totalSpend` counts only orders that were received: money committed on a draft or a
 * cancelled order was never spent. `orderedValue` is the wider commitment, so a buyer
 * can still see what is in flight.
 */
router.get("/restaurants/:restaurantId/suppliers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const [suppliers, pos] = await Promise.all([
    db.select().from(suppliersTable).where(eq(suppliersTable.restaurantId, id)),
    db.select({
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: purchaseOrdersTable.supplierName,
      status: purchaseOrdersTable.status,
      total: purchaseOrdersTable.total,
      createdAt: purchaseOrdersTable.createdAt,
      deliveredAt: purchaseOrdersTable.deliveredAt,
    }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.restaurantId, id)),
  ]);

  const RECEIVED = new Set(["received", "delivered", "completed"]);
  const VOID = new Set(["cancelled", "canceled", "rejected"]);

  res.json(suppliers.map(s => {
    const mine = pos.filter(p =>
      p.supplierId === s.id || (p.supplierId == null && (p.supplierName ?? "").trim() === s.name.trim()));
    const live = mine.filter(p => !VOID.has(String(p.status ?? "").toLowerCase()));
    const received = live.filter(p => RECEIVED.has(String(p.status ?? "").toLowerCase()));
    const money = (rows: typeof mine) => round2(rows.reduce((t, p) => t + (parseFloat(String(p.total ?? 0)) || 0), 0));
    const lastAt = mine.reduce<Date | null>((latest, p) => {
      const at = p.deliveredAt ?? p.createdAt;
      if (!at) return latest;
      const d = new Date(at);
      return latest && latest >= d ? latest : d;
    }, null);

    return {
      ...s,
      creditLimit: parseFloat(String(s.creditLimit)),
      outstandingBalance: parseFloat(String(s.outstandingBalance)),
      totalSpend: money(received),
      orderedValue: money(live),
      pendingValue: round2(money(live) - money(received)),
      totalOrders: live.length,
      receivedOrders: received.length,
      lastOrderAt: lastAt ? lastAt.toISOString() : null,
      // A supplier nobody has rated has no rating — not five stars.
      rating: s.rating ?? null,
    };
  }));
});

router.post("/restaurants/:restaurantId/suppliers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit } = req.body;
  const [supplier] = await db.insert(suppliersTable).values({ restaurantId: id, name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit: String(creditLimit ?? 0) }).returning();
  res.status(201).json(supplier);
});

router.put("/restaurants/:restaurantId/suppliers/:supplierId", requireAuth, async (req, res): Promise<void> => {
  const supplierId = parseInt(String(req.params.supplierId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit, rating } = req.body;
  const [supplier] = await db.update(suppliersTable).set({ name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, rating, creditLimit: creditLimit !== undefined ? String(creditLimit) : undefined }).where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.restaurantId, restaurantId))).returning();
  if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(supplier);
});

router.delete("/restaurants/:restaurantId/suppliers/:supplierId", requireAuth, async (req, res): Promise<void> => {
  const supplierId = parseInt(String(req.params.supplierId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  await db.delete(suppliersTable).where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.restaurantId, restaurantId)));
  res.json({ message: "Supplier deleted" });
});

router.get("/restaurants/:restaurantId/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const pos = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.restaurantId, id)).orderBy(desc(purchaseOrdersTable.createdAt));
  res.json(pos.map(p => {
    const subtotal = parseFloat(String(p.subtotal)) || 0;
    const tax = parseFloat(String(p.tax)) || 0;
    return {
      ...p,
      subtotal,
      tax,
      total: parseFloat(String(p.total)) || 0,
      // The GST on a purchase is the tax that was recorded against it. Sending the rate
      // alongside it stops a screen re-deriving the tax at a rate of its own choosing.
      taxAmount: tax,
      taxPercent: subtotal > 0 ? round2((tax / subtotal) * 100) : null,
      items: Array.isArray(p.items) ? p.items : [],
    };
  }));
});

router.post("/restaurants/:restaurantId/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { supplierId, supplierName, items, notes, expectedDelivery, taxPercent } = req.body;
  const poNumber = `PO-${Date.now()}`;
  let subtotal = 0;
  if (Array.isArray(items)) for (const item of items) subtotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  // A supplier invoice carries its own GST rate; when the buyer states one, use it.
  // Otherwise fall back to the rate this venue has configured rather than a fixed 5%.
  const requestedRate = parseFloat(String(taxPercent ?? ""));
  const rate = Number.isFinite(requestedRate) && requestedRate >= 0 && requestedRate <= 40
    ? requestedRate / 100
    : await taxRateFor(id);
  const tax = round2(subtotal * rate);
  const total = round2(subtotal + tax);
  const [po] = await db.insert(purchaseOrdersTable).values({
    restaurantId: id, supplierId: supplierId ? parseInt(supplierId) : null, supplierName, poNumber,
    items: items ?? [], subtotal: String(subtotal.toFixed(2)), tax: String(tax.toFixed(2)), total: String(total.toFixed(2)),
    notes, expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
  }).returning();
  res.status(201).json(po);
});

router.put("/restaurants/:restaurantId/purchase-orders/:poId", requireAuth, async (req, res): Promise<void> => {
  const poId = parseInt(String(req.params.poId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { status, notes } = req.body;
  const [po] = await db.update(purchaseOrdersTable).set({ status, notes, deliveredAt: status === "received" ? new Date() : undefined }).where(and(eq(purchaseOrdersTable.id, poId), eq(purchaseOrdersTable.restaurantId, restaurantId))).returning();
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  res.json(po);
});

/**
 * A purchase order raised by mistake had no way out — there was an update but no delete,
 * so a wrong order sat in the list permanently.
 */
router.delete("/restaurants/:restaurantId/purchase-orders/:poId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const poId = parseInt(String(req.params.poId), 10);
  const [row] = await db.delete(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, poId), eq(purchaseOrdersTable.restaurantId, restaurantId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Purchase order not found" }); return; }
  res.json({ success: true });
});

export default router;
