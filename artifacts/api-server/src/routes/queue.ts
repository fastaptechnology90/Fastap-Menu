import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, queueEntriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { sendReadyAlerts } from "./public-queue.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/queue", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const entries = await db.select().from(queueEntriesTable).where(eq(queueEntriesTable.restaurantId, id)).orderBy(queueEntriesTable.tokenNumber);
  res.json(entries);
});

router.post("/restaurants/:restaurantId/queue", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { guestName, guestPhone, partySize, tablePreference, specialRequests, estimatedWait } = req.body;
  const existing = await db.select({ tokenNumber: queueEntriesTable.tokenNumber }).from(queueEntriesTable).where(and(eq(queueEntriesTable.restaurantId, id), eq(queueEntriesTable.status, "waiting"))).orderBy(desc(queueEntriesTable.tokenNumber)).limit(1);
  const nextToken = existing.length > 0 ? existing[0].tokenNumber + 1 : 1;
  const [entry] = await db.insert(queueEntriesTable).values({ restaurantId: id, tokenNumber: nextToken, guestName, guestPhone, partySize: parseInt(partySize) || 1, tablePreference, specialRequests, estimatedWait: parseInt(estimatedWait) || 15 }).returning();
  res.status(201).json(entry);
});

router.put("/restaurants/:restaurantId/queue/:entryId", requireAuth, async (req, res): Promise<void> => {
  const entryId = parseInt(req.params.entryId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, estimatedWait } = req.body;
  const [entry] = await db.update(queueEntriesTable).set({
    status, estimatedWait: estimatedWait ? parseInt(estimatedWait) : undefined,
    calledAt: status === "called" ? new Date() : undefined,
    seatedAt: status === "seated" ? new Date() : undefined,
    notifiedAt: status === "called" ? new Date() : undefined,
  }).where(and(eq(queueEntriesTable.id, entryId), eq(queueEntriesTable.restaurantId, restaurantId))).returning();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (status === "called") await sendReadyAlerts(entry);
  res.json(entry);
});

router.delete("/restaurants/:restaurantId/queue/:entryId", requireAuth, async (req, res): Promise<void> => {
  const entryId = parseInt(req.params.entryId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(queueEntriesTable).where(and(eq(queueEntriesTable.id, entryId), eq(queueEntriesTable.restaurantId, restaurantId)));
  res.json({ message: "Entry removed" });
});

export default router;
