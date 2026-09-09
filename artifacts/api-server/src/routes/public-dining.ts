import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable, ordersTable } from "@workspace/db";
import { taxRateFor, round2 } from "../lib/order-pricing.js";
import { loadOwnedOrder } from "../lib/guest-order-access.js";
import { isCashPaymentMethod, isOnlinePaymentMethod } from "../lib/payment-gateway.js";
import { recordOrderPaymentInLedger } from "../lib/order-payment-ledger.js";

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

/**
 * Settle one bill between several people.
 *
 * This route was a calculator wearing a payment's clothes. It named no order, it took
 * the bill total straight from the request body, it wrote to no table, and it answered
 * `complete: true` whenever the numbers it had been handed added up. Post
 * `{"total": 10, "payments": [{"method":"upi","amount":10}]}` against a ₹235.20 bill and
 * it agreed the table was settled. Four friends each paid their share on their own
 * phone, the screen said the bill was done, and the venue had collected nothing and had
 * no record that anyone had tried.
 *
 * The amount owed now comes from the order, the caller has to own that order, a short
 * payment is refused, and the split is written onto the order the same way a single
 * payment is — so the floor, the bill and the books all agree.
 */
router.post("/public/dining/group-payment", async (req, res): Promise<void> => {
  const orderId = parseInt(String(req.body.orderId ?? 0), 10);
  if (!orderId) {
    res.status(400).json({ error: "orderId is required — a payment has to be against a bill." });
    return;
  }

  const order = await loadOwnedOrder(req, orderId);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (order.paymentStatus === "paid") {
    res.status(409).json({ error: "This bill has already been settled.", paymentStatus: order.paymentStatus });
    return;
  }

  const rawPayments = Array.isArray(req.body.payments) ? req.body.payments as { method?: string; amount?: unknown; name?: string }[] : [];
  if (!rawPayments.length) {
    res.status(400).json({ error: "Add at least one share before settling the bill." });
    return;
  }

  const payments: { method: string; amount: number; name?: string }[] = [];
  for (const p of rawPayments) {
    const amount = parseFloat(String(p.amount ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Every share needs an amount greater than zero." });
      return;
    }
    const method = String(p.method ?? "cash");
    // Same rule as the single-payment route: money only moves over the counter or
    // through a confirmed gateway charge. A method name on its own settles nothing.
    if (!isCashPaymentMethod(method)) {
      res.status(402).json({
        error: isOnlinePaymentMethod(method)
          ? "Online payment is not set up yet. Each person can pay their share at the counter."
          : "That payment method is not available yet. Please pay at the counter.",
        paymentStatus: "pending",
      });
      return;
    }
    payments.push({ method, amount: round2(amount), name: p.name ? String(p.name).slice(0, 60) : undefined });
  }

  // The bill is what the order says it is, plus any tip already recorded against it.
  const due = round2(parseFloat(String(order.total ?? 0)) + parseFloat(String(order.tipAmount ?? 0)));
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const remaining = round2(Math.max(0, due - paid));

  if (remaining >= 0.01) {
    res.status(400).json({
      error: `The shares add up to ₹${paid.toFixed(2)} but the bill is ₹${due.toFixed(2)}. ₹${remaining.toFixed(2)} is still to be covered.`,
      total: due, paid, remaining, complete: false,
    });
    return;
  }

  const meta = (typeof order.metadata === "object" && order.metadata !== null ? order.metadata : {}) as Record<string, unknown>;
  const billing = {
    ...(typeof meta.billing === "object" && meta.billing !== null ? meta.billing as object : {}),
    paymentMethod: "split",
    processedAt: new Date().toISOString(),
    splitPayment: { enabled: true, splits: payments, total: due, collected: paid },
  };

  // Cash — which is all this can be until a gateway is configured — is collected at the
  // counter, so the bill is marked awaiting collection, never "paid". Saying "paid" here
  // is the fake success screen this route used to be.
  const paymentStatus = "pending";

  const [updated] = await db.update(ordersTable).set({
    paymentMethod: "split",
    paymentStatus,
    // Nothing has been collected yet, so no invoice number is drawn: one used to be
    // stamped here on a bill that was still awaiting payment at the counter.
    metadata: { ...meta, billing },
  }).where(eq(ordersTable.id, orderId)).returning();

  // Nothing is booked to Finance while the money is still to be handed over; the ledger
  // row follows when the counter marks the order paid. Kept explicit so the next person
  // does not have to guess why there is no income row.
  if (updated.paymentStatus === "paid") {
    await recordOrderPaymentInLedger({ restaurantId: order.restaurantId, order: updated, method: "split" });
  }

  res.json({
    orderId,
    total: due,
    paid,
    remaining: 0,
    complete: true,
    recorded: true,
    paymentStatus,
    invoiceNumber: updated.invoiceNumber,
    payments,
    change: round2(Math.max(0, paid - due)),
    message: "Each share is recorded against this bill. Please settle at the counter — the total is now on your table's bill.",
  });
});

export default router;
