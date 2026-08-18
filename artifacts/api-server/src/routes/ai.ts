import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, menuItemsTable, ordersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyAiInsights,
} from "../lib/restaurant-publication.js";

const router: IRouter = Router();

router.post("/restaurants/:restaurantId/ai/generate-menu", requireAuth, async (req, res): Promise<void> => {
  const { dishName } = req.body;
  if (!dishName) { res.status(400).json({ error: "dishName required" }); return; }
  const name = String(dishName).trim();
  const isVeg = /paneer|veg|dal|dosa|idli|sambar|palak|aloo|gobi/i.test(name);
  res.json({
    name,
    description: `A signature ${name} prepared with fresh ingredients and authentic spices, slow-cooked for rich flavor and aroma.`,
    ingredients: isVeg ? ["Fresh vegetables", "Spices", "Ghee", "Herbs", "Onion", "Tomato"] : ["Premium protein", "Yogurt", "Spices", "Ghee", "Onion", "Garlic"],
    allergens: isVeg ? ["Dairy"] : ["Dairy"],
    calories: Math.floor(Math.random() * 200) + 350,
    cuisine: "Indian",
    category: "Main Course",
    suggestedPrice: Math.floor(Math.random() * 150) + 250,
    margin: "62%",
  });
});

router.post("/restaurants/:restaurantId/ai/copilot", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }

  const { question } = req.body;
  const q = String(question || "").toLowerCase();

  if (access.kind === "unpublished") {
    res.json({
      question,
      answer: "Analytics are unavailable until your restaurant is published and approved. Complete KYC and wait for platform approval to start tracking performance.",
    });
    return;
  }

  const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, rid)).orderBy(menuItemsTable.orderCount);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, rid));
  const revenue = orders.reduce((s, o) => s + parseFloat(String(o.total)), 0);
  let answer = `Total revenue: ₹${revenue.toLocaleString("en-IN")}. Active menu items: ${items.length}.`;
  if (q.includes("profit") || q.includes("top")) {
    const top = items.slice(0, 3).map(i => i.name).join(", ");
    answer = `Top sellers: ${top || "No data yet"}. Focus on promoting high-margin items during peak hours.`;
  } else if (q.includes("branch")) {
    answer = "Use Branches & Franchise panel for branch-wise performance. Best practice: compare revenue per cover across locations.";
  } else if (q.includes("stock") || q.includes("shortage")) {
    answer = "Check Inventory for low-stock alerts. Reorder raw materials 24h before predicted rush (see Operations tab).";
  }
  res.json({ question, answer });
});

router.get("/restaurants/:restaurantId/ai/insights", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyAiInsights()); return; }

  const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, rid)).orderBy(menuItemsTable.orderCount);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, rid));
  const top = items[items.length - 1];
  const low = items[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
  const todayRevenue = todayOrders.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0);
  const last7 = orders.filter(o => new Date(o.createdAt) >= new Date(Date.now() - 7 * 86400000));
  const avgDaily = last7.length ? last7.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0) / 7 : 0;
  const hourCounts = new Map<number, number>();
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 20;

  const menuOptimizations = items
    .filter(i => (i.orderCount ?? 0) <= 3)
    .slice(0, 5)
    .map(i => ({
      action: (i.orderCount ?? 0) === 0 ? "Remove" : "Reprice",
      item: i.name,
      reason: (i.orderCount ?? 0) === 0 ? "No orders recorded" : `Only ${i.orderCount} orders — low demand`,
      urgency: (i.orderCount ?? 0) === 0 ? "high" : "medium",
    }));

  res.json({
    isPublished: true,
    insights: [
      top ? { title: "Top Performer", desc: `${top.name} has ${top.orderCount ?? 0} orders. Promote it in campaigns.`, type: "opportunity" } : null,
      low && low.id !== top?.id ? { title: "Underperformer", desc: `${low.name} has ${low.orderCount ?? 0} orders. Consider repricing or combo offers.`, type: "warning" } : null,
      orders.length ? { title: "Peak Hours", desc: `Busiest hour: ${peakHour}:00–${peakHour + 1}:00 based on ${orders.length} orders.`, type: "info" } : null,
    ].filter(Boolean),
    predictions: [
      { metric: "Revenue today", value: `₹${todayRevenue.toLocaleString("en-IN")}`, change: todayOrders.length ? `${todayOrders.length} orders` : "No orders yet", trend: todayRevenue > 0 ? "up" : "neutral" },
      { metric: "7-day avg daily revenue", value: `₹${Math.round(avgDaily).toLocaleString("en-IN")}`, change: last7.length ? "From real orders" : "No history", trend: avgDaily > 0 ? "up" : "neutral" },
      { metric: "Peak rush time", value: `${peakHour}:00 - ${peakHour + 1}:30`, change: orders.length ? "From order history" : "No data", trend: "neutral" },
    ],
    menuOptimizations,
  });
});

export default router;
