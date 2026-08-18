import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, waiterCallsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/public/waiter-call", async (req, res): Promise<void> => {
  const { restaurantId, tableId, tableName, type, message } = req.body;
  if (!restaurantId || !type) { res.status(400).json({ error: "restaurantId and type required" }); return; }
  const [call] = await db.insert(waiterCallsTable).values({ restaurantId, tableId, tableName, type, message, isResolved: false }).returning();
  res.status(201).json(call);
});

router.get("/restaurants/:restaurantId/waiter-calls", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const calls = await db.select().from(waiterCallsTable).where(and(eq(waiterCallsTable.restaurantId, id), eq(waiterCallsTable.isResolved, false)));
  res.json(calls);
});

router.post("/restaurants/:restaurantId/waiter-calls/:callId/resolve", requireAuth, async (req, res): Promise<void> => {
  const callId = parseInt(req.params.callId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [call] = await db.update(waiterCallsTable).set({ isResolved: true }).where(and(eq(waiterCallsTable.id, callId), eq(waiterCallsTable.restaurantId, restaurantId))).returning();
  if (!call) { res.status(404).json({ error: "Call not found" }); return; }
  res.json(call);
});

export default router;
