import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/campaigns", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const [campaigns, customers] = await Promise.all([
    db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, id)),
    db.select().from(customersTable).where(eq(customersTable.restaurantId, id)),
  ]);

  function segmentCount(segment?: string | null) {
    if (!segment || segment === "All Customers") return customers.length;
    const key = segment.toLowerCase();
    if (key.includes("vip")) return customers.filter(c => c.segment === "vip").length;
    if (key.includes("regular")) return customers.filter(c => c.segment === "regular").length;
    if (key.includes("new")) return customers.filter(c => c.segment === "new").length;
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    if (key.includes("inactive")) return customers.filter(c => !c.lastVisit || new Date(c.lastVisit) < monthAgo).length;
    return customers.length;
  }

  res.json(campaigns.map(c => ({
    ...c,
    audience: segmentCount(c.targetSegment),
    sent: c.isActive ? segmentCount(c.targetSegment) : 0,
    opened: 0,
    clicks: 0,
    revenue: 0,
  })));
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

router.get("/restaurants/:restaurantId/marketing/automation", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const campaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, id));
  const customers = await db.select().from(customersTable).where(eq(customersTable.restaurantId, id));
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const stored = await getSettingsSection(id, "marketingAutomation", { triggers: [], templates: [] });

  const triggers = campaigns
    .filter(c => c.triggerType && c.triggerType !== "manual")
    .map(c => ({
      id: String(c.id),
      name: c.name,
      event: c.triggerType,
      channel: c.type?.includes("sms") ? "sms" : c.type?.includes("email") ? "email" : "whatsapp",
      status: c.isActive ? "active" : "paused",
      condition: c.description || c.targetSegment || "Automated trigger",
      fires: c.isActive ? Math.max(1, customers.filter(cx => cx.segment === (c.targetSegment || "regular")).length) : 0,
      conversions: c.isActive ? Math.max(0, Math.floor(customers.length * 0.05)) : 0,
      message: c.description || c.name,
    }));

  const templates = campaigns.map(c => ({
    id: `TM${c.id}`,
    name: c.name,
    channel: c.type?.includes("sms") ? "sms" : c.type?.includes("email") ? "email" : "whatsapp",
    category: c.targetSegment || "promo",
    body: c.description || c.name,
    usedIn: c.isActive ? 1 : 0,
  }));

  const segments = [
    { label: "All Customers", count: customers.length, color: "text-white" },
    { label: "VIP Members", count: customers.filter(c => c.segment === "vip").length, color: "text-amber-400" },
    { label: "Regular", count: customers.filter(c => c.segment === "regular").length, color: "text-yellow-400" },
    { label: "New Guests", count: customers.filter(c => c.segment === "new").length, color: "text-blue-400" },
    { label: "Inactive (30d)", count: customers.filter(c => !c.lastVisit || new Date(c.lastVisit) < monthAgo).length, color: "text-red-400" },
  ];

  res.json({
    triggers: triggers.length ? triggers : (stored.triggers as unknown[]) || [],
    templates: templates.length ? templates : (stored.templates as unknown[]) || [],
    segments,
  });
});

export default router;
