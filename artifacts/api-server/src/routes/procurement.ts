import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, suppliersTable, purchaseOrdersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/suppliers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.restaurantId, id));
  res.json(suppliers.map(s => ({ ...s, creditLimit: parseFloat(String(s.creditLimit)), outstandingBalance: parseFloat(String(s.outstandingBalance)) })));
});

router.post("/restaurants/:restaurantId/suppliers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit } = req.body;
  const [supplier] = await db.insert(suppliersTable).values({ restaurantId: id, name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit: String(creditLimit ?? 0) }).returning();
  res.status(201).json(supplier);
});

router.put("/restaurants/:restaurantId/suppliers/:supplierId", requireAuth, async (req, res): Promise<void> => {
  const supplierId = parseInt(req.params.supplierId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, creditLimit, rating } = req.body;
  const [supplier] = await db.update(suppliersTable).set({ name, contactPerson, phone, email, address, gstNumber, category, paymentTerms, rating, creditLimit: creditLimit !== undefined ? String(creditLimit) : undefined }).where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.restaurantId, restaurantId))).returning();
  if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(supplier);
});

router.delete("/restaurants/:restaurantId/suppliers/:supplierId", requireAuth, async (req, res): Promise<void> => {
  const supplierId = parseInt(req.params.supplierId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(suppliersTable).where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.restaurantId, restaurantId)));
  res.json({ message: "Supplier deleted" });
});

router.get("/restaurants/:restaurantId/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const pos = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.restaurantId, id)).orderBy(desc(purchaseOrdersTable.createdAt));
  res.json(pos.map(p => ({ ...p, subtotal: parseFloat(String(p.subtotal)), tax: parseFloat(String(p.tax)), total: parseFloat(String(p.total)), items: Array.isArray(p.items) ? p.items : [] })));
});

router.post("/restaurants/:restaurantId/purchase-orders", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { supplierId, supplierName, items, notes, expectedDelivery } = req.body;
  const poNumber = `PO-${Date.now()}`;
  let subtotal = 0;
  if (Array.isArray(items)) for (const item of items) subtotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  const [po] = await db.insert(purchaseOrdersTable).values({
    restaurantId: id, supplierId: supplierId ? parseInt(supplierId) : null, supplierName, poNumber,
    items: items ?? [], subtotal: String(subtotal.toFixed(2)), tax: String(tax.toFixed(2)), total: String(total.toFixed(2)),
    notes, expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
  }).returning();
  res.status(201).json(po);
});

router.put("/restaurants/:restaurantId/purchase-orders/:poId", requireAuth, async (req, res): Promise<void> => {
  const poId = parseInt(req.params.poId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, notes } = req.body;
  const [po] = await db.update(purchaseOrdersTable).set({ status, notes, deliveredAt: status === "received" ? new Date() : undefined }).where(and(eq(purchaseOrdersTable.id, poId), eq(purchaseOrdersTable.restaurantId, restaurantId))).returning();
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  res.json(po);
});

export default router;
