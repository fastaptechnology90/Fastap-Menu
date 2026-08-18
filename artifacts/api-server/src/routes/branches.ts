import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, branchesTable, ordersTable, feedbackTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyBranchAnalytics,
} from "../lib/restaurant-publication.js";

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

router.get("/restaurants/:restaurantId/franchise", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(id, "franchise", { franchisees: [] });
  res.json(Array.isArray(stored.franchisees) ? stored.franchisees : []);
});

router.put("/restaurants/:restaurantId/franchise", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  await setSettingsSection(id, "franchise", { franchisees: req.body.franchisees || [] });
  res.json({ success: true });
});

router.get("/restaurants/:restaurantId/stock-transfers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(id, "stockTransfers", { transfers: [] });
  res.json(Array.isArray(stored.transfers) ? stored.transfers : []);
});

router.put("/restaurants/:restaurantId/stock-transfers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const transfers = req.body.transfers ?? req.body;
  await setSettingsSection(id, "stockTransfers", { transfers: Array.isArray(transfers) ? transfers : [] });
  res.json(Array.isArray(transfers) ? transfers : []);
});

router.get("/restaurants/:restaurantId/branches/analytics", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyBranchAnalytics()); return; }

  const branches = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, id));
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const feedbackRows = await db.select({ rating: feedbackTable.rating }).from(feedbackTable).where(eq(feedbackTable.restaurantId, id));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const inRange = (d: Date, start: Date, end: Date) => d >= start && d < end;
  const monthOrders = orders.filter(o => inRange(new Date(o.createdAt), monthStart, now));
  const prevMonthOrders = orders.filter(o => inRange(new Date(o.createdAt), prevMonthStart, monthStart));

  const monthRevenue = monthOrders.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0);
  const prevMonthRevenue = prevMonthOrders.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0);
  const revenueTrend = prevMonthRevenue > 0
    ? `${Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) >= 0 ? "+" : ""}${Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)}%`
    : monthRevenue > 0 ? "+100%" : "—";

  const orderTrend = prevMonthOrders.length > 0
    ? `${Math.round(((monthOrders.length - prevMonthOrders.length) / prevMonthOrders.length) * 100) >= 0 ? "+" : ""}${Math.round(((monthOrders.length - prevMonthOrders.length) / prevMonthOrders.length) * 100)}%`
    : monthOrders.length > 0 ? "+100%" : "—";

  const avgRating = feedbackRows.length
    ? (feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackRows.length).toFixed(1)
    : "—";

  const bestBranch = branches[0]?.name || "Main";

  res.json([
    { metric: "Total Network Revenue", value: `₹${Math.round(monthRevenue).toLocaleString("en-IN")}`, sub: `${branches.length} branches · this month`, trend: revenueTrend, up: monthRevenue >= prevMonthRevenue },
    { metric: "Total Orders", value: String(monthOrders.length), sub: "This month", trend: orderTrend, up: monthOrders.length >= prevMonthOrders.length },
    { metric: "Active Branches", value: String(branches.filter(b => b.isActive !== false).length), sub: "Operational", trend: "Live", up: true },
    { metric: "Avg Rating", value: avgRating === "—" ? "—" : `${avgRating}★`, sub: "Customer satisfaction", trend: bestBranch, up: true },
  ]);
});

export default router;
