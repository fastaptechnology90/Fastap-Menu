import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/campaigns", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, id));
  res.json(campaigns);
});

router.post("/restaurants/:restaurantId/campaigns", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, type, description, discountPercent, discountAmount, triggerType, startDate, endDate, isActive, targetSegment } = req.body;
  const [campaign] = await db.insert(campaignsTable).values({ restaurantId: id, name, type, description, discountPercent, discountAmount, triggerType: triggerType ?? "manual", startDate, endDate, isActive: isActive ?? true, targetSegment }).returning();
  res.status(201).json(campaign);
});

router.put("/restaurants/:restaurantId/campaigns/:campaignId", requireAuth, async (req, res): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, type, description, discountPercent, discountAmount, triggerType, startDate, endDate, isActive, targetSegment } = req.body;
  const [campaign] = await db.update(campaignsTable).set({ name, type, description, discountPercent, discountAmount, triggerType, startDate, endDate, isActive, targetSegment }).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.restaurantId, restaurantId))).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(campaign);
});

router.delete("/restaurants/:restaurantId/campaigns/:campaignId", requireAuth, async (req, res): Promise<void> => {
  const campaignId = parseInt(req.params.campaignId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [deleted] = await db.delete(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json({ message: "Campaign deleted" });
});

export default router;
