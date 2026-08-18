import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tablesMapTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/tables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const tables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, id));
  res.json(tables);
});

router.post("/restaurants/:restaurantId/tables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, branchId, zone, capacity, isActive } = req.body;
  const menuUrl = `${process.env.PUBLIC_URL ?? "https://digitalrestuarants.thefingo.com"}/menu/table-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const [table] = await db.insert(tablesMapTable).values({ restaurantId: id, name, branchId, zone, capacity: capacity ?? 4, qrCodeUrl: menuUrl, isActive: isActive ?? true }).returning();
  res.status(201).json(table);
});

router.put("/restaurants/:restaurantId/tables/:tableId", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, branchId, zone, capacity, isActive } = req.body;
  const [table] = await db.update(tablesMapTable).set({ name, branchId, zone, capacity, isActive }).where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId))).returning();
  if (!table) { res.status(404).json({ error: "Table not found" }); return; }
  res.json(table);
});

router.delete("/restaurants/:restaurantId/tables/:tableId", requireAuth, async (req, res): Promise<void> => {
  const tableId = parseInt(req.params.tableId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(tablesMapTable).where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Table not found" }); return; }
  res.json({ message: "Table deleted" });
});

export default router;
