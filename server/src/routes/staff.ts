import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, staffTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const staff = await db.select().from(staffTable).where(eq(staffTable.restaurantId, id));
  res.json(staff);
});

router.post("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, email, role, isActive } = req.body;
  const [member] = await db.insert(staffTable).values({ restaurantId: id, name, email, role, isActive: isActive ?? true }).returning();
  res.status(201).json(member);
});

router.put("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.staffId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, email, role, isActive } = req.body;
  const [member] = await db.update(staffTable).set({ name, email, role, isActive }).where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId))).returning();
  if (!member) { res.status(404).json({ error: "Staff not found" }); return; }
  res.json(member);
});

router.delete("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.staffId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(staffTable).where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Staff not found" }); return; }
  res.json({ message: "Staff removed" });
});

export default router;
