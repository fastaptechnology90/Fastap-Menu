import { Router, type IRouter } from "express";
import { eq, and, gte, lt } from "drizzle-orm";
import { db, ordersTable, cashShiftsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { round2 } from "../lib/order-pricing.js";
import { isPaidOrder } from "../lib/payment-calculations.js";

/**
 * The day-end report a restaurant closes on.
 *
 * There was no way to answer "what did we take today" from the product — the dashboard
 * showed a rounded figure and nothing broke it down, so cash could not be reconciled
 * against the drawer and no manager could sign off a shift. Everything here is computed
 * from the orders and shifts already recorded; nothing new is stored, so running it twice
 * cannot change the numbers.
 *
 * X and Z are the two readings a till has always had: X is the state right now, taken
 * mid-service as often as you like; Z is the closing reading for a business day.
 */

const router: IRouter = Router();

/** A restaurant's day runs past midnight, so a business day is offset rather than a calendar one. */
function dayBounds(dateStr: string | undefined) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // Label the day the restaurant is actually in. toISOString() would report the UTC date,
  // which in India is the previous day for every reading taken before 5:30am — the report
  // would be headed with yesterday's date while covering today's takings.
  const label = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, "0"),
    String(start.getDate()).padStart(2, "0"),
  ].join("-");
  return { start, end, label };
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

async function buildReport(restaurantId: number, dateStr: string | undefined) {
  const bounds = dayBounds(dateStr);
  if (!bounds) return null;

  const orders = await db.select().from(ordersTable).where(and(
    eq(ordersTable.restaurantId, restaurantId),
    gte(ordersTable.createdAt, bounds.start),
    lt(ordersTable.createdAt, bounds.end),
  ));

  // A cancelled order is not a taking, even if it was marked paid before it was voided —
  // a UPI order auto-marks paid and can then be cancelled. This filter used to be
  // "paid OR completed" with no cancellation check, so the same orders were counted in
  // BOTH `settled` and `cancelled` and the Z reading reported money that had been handed
  // back. The dashboard and Revenue have always excluded them, so the two disagreed by the
  // value of every cancelled bill. `isPaidOrder` is the one rule the rest of the product
  // settles revenue by; the day-end reading now uses it too.
  // `isPaidOrder` alone drops a part-refunded bill outright, which would lose the money
  // that WAS kept on it; the refund itself is netted off just below.
  const settled = orders.filter(o =>
    isPaidOrder(o)
    || (String(o.paymentStatus ?? "") === "partially_refunded" && String(o.status ?? "") !== "cancelled"),
  );
  const cancelled = orders.filter(o => o.status === "cancelled");
  const refunded = orders.filter(o => String(o.paymentStatus ?? "").includes("refund"));

  /** What was actually handed back on an order, from the adjustment trail on it. */
  const refundedOn = (o: typeof orders[number]) => {
    const meta = (typeof o.metadata === "object" && o.metadata !== null ? o.metadata : {}) as Record<string, unknown>;
    const r = meta.refund as { total?: unknown } | undefined;
    return num(r?.total);
  };
  // Money given back during the day comes off the day's takings. A partly refunded order
  // keeps its full total on the row, so without this the report overstates the till by
  // every rupee refunded.
  // Only over `settled`: an order refunded in full has already left that list, so counting
  // its refund here as well would subtract the same money twice.
  const refundsGiven = round2(settled.reduce((t, o) => t + refundedOn(o), 0));

  const sum = (rows: typeof orders, field: "subtotal" | "tax" | "total" | "tipAmount" | "discountAmount") =>
    round2(rows.reduce((t, o) => t + num(o[field]), 0));

  // By payment method — the figure a cashier counts the drawer against.
  const byMethod: Record<string, { count: number; amount: number }> = {};
  for (const o of settled) {
    const method = String(o.paymentMethod ?? "uncollected").toLowerCase();
    byMethod[method] ??= { count: 0, amount: 0 };
    byMethod[method].count += 1;
    // Net of anything refunded on this order, so the cash line equals what is in the drawer.
    byMethod[method].amount = round2(byMethod[method].amount + num(o.total) - refundedOn(o));
  }

  const byType: Record<string, { count: number; amount: number }> = {};
  for (const o of settled) {
    // "dine-in" and "dine_in" are both written by different order paths and were reported
    // as two separate order types, splitting one day's dine-in trade across two lines.
    const type = String(o.type ?? "dine_in").toLowerCase().replace(/-/g, "_");
    byType[type] ??= { count: 0, amount: 0 };
    byType[type].count += 1;
    byType[type].amount = round2(byType[type].amount + num(o.total));
  }

  // Per waiter, so commission and performance rest on something real.
  const byStaff: Record<string, { orders: number; amount: number }> = {};
  for (const o of settled) {
    const who = o.waiterName ?? "unassigned";
    byStaff[who] ??= { orders: 0, amount: 0 };
    byStaff[who].orders += 1;
    byStaff[who].amount = round2(byStaff[who].amount + num(o.total));
  }

  // What was taken off the bill, and by whom — the figures a manager reviews.
  const adjustments: { type: string; item?: string; amount: number; reason: string; by: string }[] = [];
  for (const o of orders) {
    const meta = (typeof o.metadata === "object" && o.metadata !== null ? o.metadata : {}) as Record<string, unknown>;
    for (const a of (Array.isArray(meta.adjustments) ? meta.adjustments : []) as typeof adjustments) {
      adjustments.push(a);
    }
  }
  const adjustmentTotals = adjustments.reduce((acc, a) => {
    acc[a.type] ??= { count: 0, amount: 0 };
    acc[a.type].count += 1;
    acc[a.type].amount = round2(acc[a.type].amount + num(a.amount));
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const shifts = await db.select().from(cashShiftsTable).where(and(
    eq(cashShiftsTable.restaurantId, restaurantId),
    gte(cashShiftsTable.openedAt, bounds.start),
    lt(cashShiftsTable.openedAt, bounds.end),
  ));

  const cashTaken = byMethod.cash?.amount ?? 0;
  const drawerCounted = round2(shifts.reduce((t, s) => t + num(s.closingBalance), 0));
  const drawerOpening = round2(shifts.reduce((t, s) => t + num(s.openingBalance), 0));

  return {
    date: bounds.label,
    orders: {
      placed: orders.length,
      settled: settled.length,
      cancelled: cancelled.length,
      refunded: refunded.length,
    },
    sales: {
      subtotal: sum(settled, "subtotal"),
      tax: sum(settled, "tax"),
      tips: sum(settled, "tipAmount"),
      discounts: sum(settled, "discountAmount"),
      total: round2(sum(settled, "total") - refundsGiven),
      grossTotal: sum(settled, "total"),
      refunds: refundsGiven,
      averageOrder: settled.length ? round2(sum(settled, "total") / settled.length) : 0,
    },
    byPaymentMethod: byMethod,
    byOrderType: byType,
    byStaff,
    adjustments: adjustmentTotals,
    cash: {
      takenPerOrders: cashTaken,
      drawerOpening,
      drawerCounted,
      // Positive means the drawer holds more than the orders account for.
      variance: round2(drawerCounted - drawerOpening - cashTaken),
      shiftsOpen: shifts.filter(s => !s.closedAt).length,
    },
  };
}

/** X reading — where the day stands right now. Safe to take as often as you like. */
router.get("/restaurants/:restaurantId/reports/x", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const report = await buildReport(restaurantId, req.query.date as string | undefined);
  if (!report) { res.status(400).json({ error: "Invalid date" }); return; }
  res.json({ reading: "X", ...report });
});

/**
 * Z reading — the closing figures for a business day. Refuses while a cash shift is still
 * open, because a drawer that has not been counted cannot be reconciled and a Z taken
 * mid-shift is the classic way a day's cash goes unaccounted for.
 */
router.get("/restaurants/:restaurantId/reports/z", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const report = await buildReport(restaurantId, req.query.date as string | undefined);
  if (!report) { res.status(400).json({ error: "Invalid date" }); return; }

  if (report.cash.shiftsOpen > 0 && req.query.force !== "true") {
    res.status(409).json({
      error: `${report.cash.shiftsOpen} cash shift(s) are still open. Close them before taking the Z reading, or pass force=true to read anyway.`,
      shiftsOpen: report.cash.shiftsOpen,
    });
    return;
  }

  res.json({ reading: "Z", ...report });
});

export default router;
