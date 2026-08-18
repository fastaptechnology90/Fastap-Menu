import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notificationsLogTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/notifications-log", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const logs = await db.select().from(notificationsLogTable).where(eq(notificationsLogTable.restaurantId, id)).orderBy(desc(notificationsLogTable.createdAt)).limit(100);
  res.json(logs);
});

router.post("/restaurants/:restaurantId/notifications-log", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { type, title, message, recipient, recipientType, metadata } = req.body;
  const [log] = await db.insert(notificationsLogTable).values({ restaurantId: id, type, title, message, recipient, recipientType, metadata: metadata ?? {}, status: "sent" }).returning();
  res.status(201).json(log);
});

export default router;
