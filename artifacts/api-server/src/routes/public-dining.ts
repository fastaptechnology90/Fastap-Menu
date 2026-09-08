import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable, ordersTable } from "@workspace/db";
import { taxRateFor, round2 } from "../lib/order-pricing.js";

const router: IRouter = Router();

const CLOSED_STATUSES = ["cancelled", "completed", "delivered"];

router.get("/public/dining/running-bill", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  const tableName = String(req.query.table ?? req.query.tableName ?? "").trim();
  const slug = req.query.slug as string | undefined;

  let rid = restaurantId;
  if (!rid && slug) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
    rid = r?.id ?? 0;
  }
  if (!rid) { res.status(400).json({ error: "restaurantId or slug required" }); return; }

  // A running bill belongs to one table. Without this the table filter was optional, so
  // any guest who reached the page without a table — a reload that dropped ?table=, a
  // bookmark — was handed every open order in the venue: other diners' dishes, their
  // totals, and a "pay" button over the lot.
  if (!tableName) {
    res.status(400).json({ error: "Scan your table's QR code to see its bill." });
    return;
  }

  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, rid));
  const active = orders.filter(o =>
    !CLOSED_STATUSES.includes(o.status) && o.tableName === tableName,
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
      const qty = Number(item.quantity ?? 1) || 1;
      // The stored line price already has the chosen portion and every add-on folded in —
      // that is what the order was priced and charged at. Adding the add-ons a second time
      // here billed the table more for the same food than the order itself says.
      const unitPrice = parseFloat(String(item.price ?? 0)) || 0;
      const lineTotal = item.subtotal != null
        ? parseFloat(String(item.subtotal)) || 0
        : Math.round(unitPrice * qty * 100) / 100;
      lines.push({
        id: `order-${order.id}-${item.id ?? item.menuItemId}`,
        name: String(item.name),
        unitPrice,
        quantity: qty,
        lineTotal,
        source: "order",
        orderId: String(order.id),
        paid: order.paymentStatus === "paid",
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  // The live table bill taxed at a flat 5% while the orders on it were taxed at the
  // venue's own rate, so the running total the guest watched did not match the bill.
  const gstRate = await taxRateFor(rid);
  const gst = round2(subtotal * gstRate);
  res.json({
    lines,
    subtotal,
    gst,
    gstRatePercent: Math.round(gstRate * 10000) / 100,
    total: round2(subtotal + gst),
    orderCount: active.length,
    updatedAt: new Date().toISOString(),
  });
});

router.post("/public/dining/split-bill", async (req, res): Promise<void> => {
  const lines = Array.isArray(req.body.lines) ? req.body.lines as { lineTotal: number; paid?: boolean }[] : [];
  const splitCount = Math.max(2, parseInt(String(req.body.splitCount ?? 2), 10));
  const seatCount = Math.max(1, parseInt(String(req.body.seatCount ?? 1), 10));
  const mode = String(req.body.mode ?? "equal");
  const unpaid = lines.filter(l => !l.paid);
  const subtotal = unpaid.reduce((s, l) => s + parseFloat(String(l.lineTotal ?? 0)), 0);
  // A split bill is the same bill divided up, so it is taxed at the venue's own rate.
  const rid = parseInt(String(req.body.restaurantId ?? ""), 10);
  const gstRate = Number.isFinite(rid) ? await taxRateFor(rid) : 0.05;
  const gst = round2(subtotal * gstRate);
  const total = round2(subtotal + gst);

  if (mode === "seat_wise" && seatCount > 1) {
    const perSeat = Math.round((total / seatCount) * 100) / 100;
    const seats = Array.from({ length: seatCount }, (_, i) => ({
      seat: i + 1,
      amount: i === seatCount - 1 ? total - perSeat * (seatCount - 1) : perSeat,
    }));
    res.json({ mode, subtotal, gst, total, seats, splitCount: seatCount });
    return;
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
