import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, staffCommissionsTable, chatMessagesTable, ordersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { orderGrossTotal, orderCommissionBase } from "../lib/payment-calculations.js";

const router: IRouter = Router();

/**
 * Each row now carries the value of the order it came from.
 *
 * Without it a screen wanting "sales per server" had nothing to read and was scaling the
 * commission amount by a constant instead — a figure that tracked the commission rate
 * rather than the sales. `orderAmount` is what the guest actually paid; `orderBase` is
 * the pre-tax value the commission was worked out on. A row not tied to an order (a
 * manual incentive, a tips pool) reports null rather than a number that looks like sales.
 */
router.get("/restaurants/:restaurantId/commissions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const commissions = await db.select().from(staffCommissionsTable).where(eq(staffCommissionsTable.restaurantId, id)).orderBy(desc(staffCommissionsTable.createdAt));

  const orderIds = [...new Set(commissions.map(c => c.orderId).filter((x): x is number => x != null))];
  const orders = orderIds.length
    ? await db.select({
        id: ordersTable.id, total: ordersTable.total, subtotal: ordersTable.subtotal,
        paymentStatus: ordersTable.paymentStatus, status: ordersTable.status,
      }).from(ordersTable).where(and(eq(ordersTable.restaurantId, id), inArray(ordersTable.id, orderIds)))
    : [];
  const byOrder = new Map(orders.map(o => [o.id, o]));

  res.json(commissions.map(c => {
    const order = c.orderId != null ? byOrder.get(c.orderId) : undefined;
    return {
      ...c,
      amount: parseFloat(String(c.amount)),
      percentage: c.percentage ? parseFloat(String(c.percentage)) : null,
      orderAmount: order ? orderGrossTotal(order) : null,
      orderBase: order ? orderCommissionBase(order) : null,
    };
  }));
});

router.post("/restaurants/:restaurantId/commissions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { staffId, staffName, staffRole, type, orderId, amount, percentage, description, month } = req.body;
  const [commission] = await db.insert(staffCommissionsTable).values({ restaurantId: id, staffId: staffId ? parseInt(staffId) : null, staffName, staffRole, type, orderId: orderId ? parseInt(orderId) : null, amount: String(parseFloat(amount) || 0), percentage: percentage ? String(parseFloat(percentage)) : null, description, month }).returning();
  res.status(201).json(commission);
});

router.put("/restaurants/:restaurantId/commissions/:commissionId", requireAuth, async (req, res): Promise<void> => {
  const commissionId = parseInt(req.params.commissionId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status } = req.body;
  const [commission] = await db.update(staffCommissionsTable).set({ status, paidAt: status === "paid" ? new Date() : undefined }).where(and(eq(staffCommissionsTable.id, commissionId), eq(staffCommissionsTable.restaurantId, restaurantId))).returning();
  if (!commission) { res.status(404).json({ error: "Commission not found" }); return; }
  res.json(commission);
});

router.get("/restaurants/:restaurantId/chat", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { channel } = req.query;
  const messages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.restaurantId, id)).orderBy(desc(chatMessagesTable.createdAt)).limit(100);
  const filtered = channel ? messages.filter(m => m.channel === channel) : messages;
  res.json(filtered.reverse());
});

router.post("/restaurants/:restaurantId/chat", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { senderId, senderName, senderRole, message, messageType, channel } = req.body;
  const [msg] = await db.insert(chatMessagesTable).values({ restaurantId: id, senderId, senderName, senderRole, message, messageType, channel }).returning();
  res.status(201).json(msg);
});

export default router;
