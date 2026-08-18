import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, menuItemsTable, customersTable, feedbackTable, reservationsTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { broadcastEvent } from "../lib/sse.js";

const router: IRouter = Router();

function parseOrder(o: any) {
  return {
    ...o,
    subtotal: parseFloat(String(o.subtotal ?? "0")),
    tax: parseFloat(String(o.tax ?? "0")),
    total: parseFloat(String(o.total ?? "0")),
    items: Array.isArray(o.items) ? o.items : [],
  };
}

router.get("/restaurants/:restaurantId/orders", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status } = req.query;
  let orders;
  if (status) {
    orders = await db.select().from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.status, status as string))).orderBy(desc(ordersTable.createdAt));
  } else {
    orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId)).orderBy(desc(ordersTable.createdAt));
  }
  res.json(orders.map(parseOrder));
});

router.get("/restaurants/:restaurantId/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(parseOrder(order));
});

router.put("/restaurants/:restaurantId/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const orderId = parseInt(req.params.orderId, 10);
  const { status } = req.body;
  const [order] = await db.update(ordersTable).set({ status }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.restaurantId, restaurantId))).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  broadcastEvent("order_status", { id: order.id, tableName: order.tableName, status });
  res.json(parseOrder(order));
});

router.post("/public/orders", async (req, res): Promise<void> => {
  const { restaurantId, tableId, tableName, customerName, customerPhone, customerEmail, type, items, notes, deliveryAddress, paymentMethod } = req.body;
  if (!restaurantId || !items || !Array.isArray(items)) { res.status(400).json({ error: "restaurantId and items required" }); return; }
  const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
  const menuMap = new Map(menuItems.map(m => [m.id, m]));
  let subtotal = 0;
  const orderItems: any[] = [];
  for (const item of items) {
    const mi = menuMap.get(item.menuItemId);
    if (!mi) { res.status(400).json({ error: `Menu item ${item.menuItemId} not found` }); return; }
    const price = parseFloat(String(mi.discountedPrice || mi.price));
    subtotal += price * item.quantity;
    orderItems.push({ id: mi.id, menuItemId: mi.id, name: mi.name, price, quantity: item.quantity, variant: item.variant, addons: item.addons, notes: item.notes, subtotal: price * item.quantity });
  }
  const tax = parseFloat((subtotal * 0.05).toFixed(2));
  const total = subtotal + tax;
  const [order] = await db.insert(ordersTable).values({
    restaurantId, tableId: tableId ?? null, tableName: tableName ?? null,
    customerName: customerName ?? null, customerPhone: customerPhone ?? null, customerEmail: customerEmail ?? null,
    type: type ?? "dine_in", status: "pending", items: orderItems,
    subtotal: String(subtotal.toFixed(2)), tax: String(tax), total: String(total.toFixed(2)),
    notes: notes ?? null, deliveryAddress: deliveryAddress ?? null,
    paymentMethod: paymentMethod ?? null, paymentStatus: "pending",
  }).returning();
  for (const item of items) {
    const mi = menuMap.get(item.menuItemId);
    if (mi) await db.update(menuItemsTable).set({ orderCount: mi.orderCount + item.quantity }).where(eq(menuItemsTable.id, mi.id));
  }
  if (customerPhone || customerEmail) {
    const existing = await db.select().from(customersTable).where(eq(customersTable.restaurantId, restaurantId));
    const found = existing.find(c => (customerPhone && c.phone === customerPhone) || (customerEmail && c.email === customerEmail));
    if (found) {
      await db.update(customersTable).set({
        totalOrders: found.totalOrders + 1,
        totalSpend: String((parseFloat(String(found.totalSpend)) + total).toFixed(2)),
        lastVisit: new Date(),
        segment: found.totalOrders + 1 >= 10 ? "vip" : found.totalOrders + 1 >= 3 ? "regular" : "new",
      }).where(eq(customersTable.id, found.id));
    } else {
      await db.insert(customersTable).values({ restaurantId, name: customerName ?? null, phone: customerPhone ?? null, email: customerEmail ?? null, totalOrders: 1, totalSpend: String(total.toFixed(2)), lastVisit: new Date(), segment: "new" });
    }
  }
  broadcastEvent("new_order", { id: order.id, restaurantId, tableName, total, status: "pending" });
  res.status(201).json(parseOrder(order));
});

router.get("/public/orders/:orderId", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(parseOrder(order));
});

router.post("/public/feedback", async (req, res): Promise<void> => {
  const { restaurantId, orderId, customerName, rating, foodRating, serviceRating, ambienceRating, comment } = req.body;
  if (!restaurantId || !rating) { res.status(400).json({ error: "restaurantId and rating required" }); return; }
  const [fb] = await db.insert(feedbackTable).values({ restaurantId, orderId, customerName, rating, foodRating, serviceRating, ambienceRating, comment }).returning();
  res.status(201).json(fb);
});

router.post("/public/reservations", async (req, res): Promise<void> => {
  const { restaurantId, customerName, customerPhone, customerEmail, date, time, guestCount, notes } = req.body;
  if (!restaurantId || !customerName || !customerPhone || !date || !time) { res.status(400).json({ error: "Required fields missing" }); return; }
  const [reservation] = await db.insert(reservationsTable).values({ restaurantId, customerName, customerPhone, customerEmail, date, time, guestCount: guestCount ?? 2, notes, status: "pending" }).returning();
  res.status(201).json(reservation);
});

export default router;
