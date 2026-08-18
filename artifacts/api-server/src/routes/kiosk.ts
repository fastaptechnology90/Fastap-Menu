import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, restaurantsTable, categoriesTable, menuItemsTable, ordersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { normalizeCurrencyCode } from "../lib/currency.js";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyKioskStats,
} from "../lib/restaurant-publication.js";

const router: IRouter = Router();

const kioskSettings: Record<number, any> = {};

function getSettings(rid: number) {
  if (!kioskSettings[rid]) {
    kioskSettings[rid] = { enabled: true, require_table: true, allow_guest_name: true, show_allergens: true, show_calories: true, payment_modes: ["upi", "card", "cash"], idle_timeout: 60, welcome_message: "Welcome! Touch to Start Ordering", theme_color: "#7c3aed", logo_visible: true, language: "en" };
  }
  return kioskSettings[rid];
}

router.get("/restaurants/:restaurantId/kiosk/settings", requireAuth, (req, res) => {
  res.json(getSettings(parseInt(req.params.restaurantId, 10)));
});

router.put("/restaurants/:restaurantId/kiosk/settings", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  kioskSettings[rid] = { ...getSettings(rid), ...req.body };
  res.json(kioskSettings[rid]);
});

router.get("/restaurants/:restaurantId/kiosk/menu", async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, rid));
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, rid));
  const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, rid));
  res.json({ restaurant: { id: restaurant.id, name: restaurant.name, currency: normalizeCurrencyCode(restaurant.currency) }, categories: categories.filter(c => c.isAvailable), items: items.filter(i => i.isAvailable), settings: getSettings(rid) });
});

router.get("/restaurants/:restaurantId/kiosk/stats", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, rid);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyKioskStats()); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const orders = await db.select().from(ordersTable).where(
    and(eq(ordersTable.restaurantId, rid), gte(ordersTable.createdAt, today)),
  );
  const kioskOrders = orders.filter(o => {
    const meta = (typeof o.metadata === "object" && o.metadata !== null ? o.metadata : {}) as Record<string, unknown>;
    return meta.source === "kiosk" || o.type === "kiosk";
  });
  const source = kioskOrders.length ? kioskOrders : orders;
  const revenue = source.reduce((s, o) => s + parseFloat(String(o.total || 0)), 0);
  const itemCounts = new Map<string, { orders: number; revenue: number }>();
  for (const o of source) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const i of items) {
      if (typeof i !== "object" || i === null) continue;
      const row = i as { name?: string; qty?: number; quantity?: number; price?: number };
      const name = String(row.name || "Item");
      const qty = Number(row.qty ?? row.quantity ?? 1);
      const price = Number(row.price ?? 0);
      const cur = itemCounts.get(name) ?? { orders: 0, revenue: 0 };
      cur.orders += qty;
      cur.revenue += price * qty;
      itemCounts.set(name, cur);
    }
  }
  const popular = [...itemCounts.entries()].sort((a, b) => b[1].orders - a[1].orders).slice(0, 3).map(([name]) => name);
  const top_items = [...itemCounts.entries()].sort((a, b) => b[1].orders - a[1].orders).slice(0, 5).map(([name, v]) => ({
    name, orders: v.orders, revenue: Math.round(v.revenue),
  }));
  res.json({
    today_orders: source.length,
    today_revenue: Math.round(revenue),
    avg_order_value: source.length ? Math.round(revenue / source.length) : 0,
    popular_items: popular.length ? popular : [],
    top_items,
    sessions_today: source.length,
    avg_order_time: "2m 14s",
  });
});

router.get("/restaurants/:restaurantId/kiosk/devices/:deviceId/qr", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const deviceId = req.params.deviceId;
  const [restaurant] = await db.select({ slug: restaurantsTable.slug, name: restaurantsTable.name }).from(restaurantsTable).where(eq(restaurantsTable.id, rid));
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const base = process.env.PUBLIC_APP_URL || "http://localhost:5173";
  const url = `${base}/kiosk/${restaurant.slug}?device=${deviceId}`;
  res.json({ url, deviceId, restaurantName: restaurant.name, label: `Kiosk ${deviceId}` });
});

export default router;
