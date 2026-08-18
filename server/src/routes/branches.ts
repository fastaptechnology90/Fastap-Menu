import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, branchesTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/branches", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const branches = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, id));
  res.json(branches);
});

router.post("/restaurants/:restaurantId/branches", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, address, phone, isActive } = req.body;
  const [branch] = await db.insert(branchesTable).values({ restaurantId: id, name, address, phone, isActive: isActive ?? true }).returning();
  res.status(201).json(branch);
});

router.put("/restaurants/:restaurantId/branches/:branchId", requireAuth, async (req, res): Promise<void> => {
  const branchId = parseInt(req.params.branchId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, address, phone, isActive } = req.body;
  const [branch] = await db.update(branchesTable).set({ name, address, phone, isActive }).where(and(eq(branchesTable.id, branchId), eq(branchesTable.restaurantId, restaurantId))).returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json(branch);
});

router.delete("/restaurants/:restaurantId/branches/:branchId", requireAuth, async (req, res): Promise<void> => {
  const branchId = parseInt(req.params.branchId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(branchesTable).where(and(eq(branchesTable.id, branchId), eq(branchesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json({ message: "Branch deleted" });
});

export default router;
