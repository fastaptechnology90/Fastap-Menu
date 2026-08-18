import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable, ordersTable } from "@workspace/db";

const router: IRouter = Router();

const CLOSED_STATUSES = ["cancelled", "completed", "delivered"];

router.get("/public/dining/running-bill", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  const tableName = req.query.table as string | undefined;
  const slug = req.query.slug as string | undefined;

  let rid = restaurantId;
  if (!rid && slug) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    rid = r?.id ?? 0;
  }
  if (!rid) { res.status(400).json({ error: "restaurantId or slug required" }); return; }

  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, rid));
  const active = orders.filter(o =>
    !CLOSED_STATUSES.includes(o.status) &&
    (!tableName || o.tableName === tableName),
  );

  const lines: {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    source: "order";
    orderId: string;
    paid: boolean;
  }[] = [];

  for (const order of active) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items as Record<string, unknown>[]) {
      const qty = Number(item.quantity ?? 1);
      const price = parseFloat(String(item.price ?? 0));
      const addonTotal = Array.isArray(item.addons)
        ? (item.addons as Record<string, unknown>[]).reduce((s, a) => s + parseFloat(String(a.price ?? 0)), 0)
        : 0;
      lines.push({
        id: `order-${order.id}-${item.id ?? item.menuItemId}`,
        name: String(item.name),
        unitPrice: price + addonTotal,
        quantity: qty,
        lineTotal: (price + addonTotal) * qty,
        source: "order",
        orderId: String(order.id),
        paid: order.paymentStatus === "paid",
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const gst = Math.round(subtotal * 0.05);
  res.json({
    lines,
    subtotal,
    gst,
    total: subtotal + gst,
    orderCount: active.length,
    updatedAt: new Date().toISOString(),
  });
});

router.post("/public/dining/split-bill", (req, res) => {
  const lines = Array.isArray(req.body.lines) ? req.body.lines as { lineTotal: number; paid?: boolean }[] : [];
  const splitCount = Math.max(2, parseInt(String(req.body.splitCount ?? 2), 10));
  const seatCount = Math.max(1, parseInt(String(req.body.seatCount ?? 1), 10));
  const mode = String(req.body.mode ?? "equal");
  const unpaid = lines.filter(l => !l.paid);
  const subtotal = unpaid.reduce((s, l) => s + parseFloat(String(l.lineTotal ?? 0)), 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + gst;

  if (mode === "seat_wise" && seatCount > 1) {
    const perSeat = Math.round((total / seatCount) * 100) / 100;
    const seats = Array.from({ length: seatCount }, (_, i) => ({
      seat: i + 1,
      amount: i === seatCount - 1 ? total - perSeat * (seatCount - 1) : perSeat,
    }));
    return res.json({ mode, subtotal, gst, total, seats, splitCount: seatCount });
  }

  const perPerson = Math.round((total / splitCount) * 100) / 100;
  const splits = Array.from({ length: splitCount }, (_, i) => ({
    person: i + 1,
    amount: i === splitCount - 1 ? total - perPerson * (splitCount - 1) : perPerson,
  }));
  res.json({ mode: mode === "item_wise" ? "item_wise" : "equal", subtotal, gst, total, splits, splitCount });
});

router.post("/public/dining/group-payment", (req, res) => {
  const total = parseFloat(String(req.body.total ?? 0));
  const payments = Array.isArray(req.body.payments) ? req.body.payments as { method: string; amount: number }[] : [];
  const paid = payments.reduce((s, p) => s + parseFloat(String(p.amount ?? 0)), 0);
  const remaining = Math.max(0, total - paid);
  res.json({
    total,
    paid,
    remaining,
    complete: remaining < 0.01,
    payments,
    change: paid > total ? Math.round((paid - total) * 100) / 100 : 0,
  });
});

export default router;
