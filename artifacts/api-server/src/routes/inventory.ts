import { Router, type IRouter } from "express";
import { eq, and, lt, desc } from "drizzle-orm";
import { db, inventoryItemsTable, inventoryTransactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/inventory", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const items = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.restaurantId, id)).orderBy(inventoryItemsTable.name);
  const parsed = items.map(i => ({
    ...i,
    currentStock: parseFloat(String(i.currentStock)),
    minStock: parseFloat(String(i.minStock)),
    maxStock: parseFloat(String(i.maxStock)),
    costPerUnit: parseFloat(String(i.costPerUnit)),
    isLow: parseFloat(String(i.currentStock)) <= parseFloat(String(i.minStock)),
  }));
  res.json(parsed);
});

router.get("/restaurants/:restaurantId/inventory/low-stock", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const items = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.restaurantId, id));
  const low = items.filter(i => parseFloat(String(i.currentStock)) <= parseFloat(String(i.minStock)));
  res.json(low.map(i => ({ ...i, currentStock: parseFloat(String(i.currentStock)), minStock: parseFloat(String(i.minStock)) })));
});

router.post("/restaurants/:restaurantId/inventory", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, category, unit, currentStock, minStock, maxStock, costPerUnit, supplier, expiryDate, location } = req.body;
  const [item] = await db.insert(inventoryItemsTable).values({
    restaurantId: id, name, category, unit, currentStock: String(currentStock ?? 0),
    minStock: String(minStock ?? 0), maxStock: String(maxStock ?? 0),
    costPerUnit: String(costPerUnit ?? 0), supplier, location,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
  }).returning();
  res.status(201).json(item);
});

router.put("/restaurants/:restaurantId/inventory/:itemId", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, category, unit, currentStock, minStock, maxStock, costPerUnit, supplier, location, expiryDate } = req.body;
  const [item] = await db.update(inventoryItemsTable).set({
    name, category, unit, supplier, location,
    currentStock: currentStock !== undefined ? String(currentStock) : undefined,
    minStock: minStock !== undefined ? String(minStock) : undefined,
    maxStock: maxStock !== undefined ? String(maxStock) : undefined,
    costPerUnit: costPerUnit !== undefined ? String(costPerUnit) : undefined,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    lastUpdated: new Date(),
  }).where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.restaurantId, restaurantId))).returning();
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(item);
});

router.delete("/restaurants/:restaurantId/inventory/:itemId", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.restaurantId, restaurantId)));
  res.json({ message: "Item deleted" });
});

router.post("/restaurants/:restaurantId/inventory/:itemId/transaction", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { type, quantity, reason, reference, performedBy } = req.body;
  const [existing] = await db.select().from(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.restaurantId, restaurantId)));
  if (!existing) { res.status(404).json({ error: "Item not found" }); return; }
  const current = parseFloat(String(existing.currentStock));
  const qty = parseFloat(String(quantity));
  const newStock = type === "in" ? current + qty : current - qty;
  await db.update(inventoryItemsTable).set({ currentStock: String(Math.max(0, newStock)), lastUpdated: new Date() }).where(eq(inventoryItemsTable.id, itemId));
  const [tx] = await db.insert(inventoryTransactionsTable).values({ restaurantId, itemId, type, quantity: String(qty), reason, reference, performedBy }).returning();
  res.status(201).json(tx);
});

router.get("/restaurants/:restaurantId/inventory/:itemId/transactions", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseInt(req.params.itemId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const txs = await db.select().from(inventoryTransactionsTable).where(and(eq(inventoryTransactionsTable.itemId, itemId), eq(inventoryTransactionsTable.restaurantId, restaurantId))).orderBy(desc(inventoryTransactionsTable.createdAt));
  res.json(txs.map(t => ({ ...t, quantity: parseFloat(String(t.quantity)) })));
});

export default router;
