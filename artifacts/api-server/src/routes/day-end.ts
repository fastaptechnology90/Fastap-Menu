import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, ordersTable, cashShiftsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { round2 } from "../lib/order-pricing.js";

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
  return { start, end, label: start.toISOString().slice(0, 10) };
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
    lte(ordersTable.createdAt, bounds.end),
  ));

  const settled = orders.filter(o => o.paymentStatus === "paid" || o.status === "completed");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const refunded = orders.filter(o => String(o.paymentStatus ?? "").includes("refund"));

  const sum = (rows: typeof orders, field: "subtotal" | "tax" | "total" | "tipAmount" | "discountAmount") =>
    round2(rows.reduce((t, o) => t + num(o[field]), 0));

  // By payment method — the figure a cashier counts the drawer against.
  const byMethod: Record<string, { count: number; amount: number }> = {};
  for (const o of settled) {
    const method = String(o.paymentMethod ?? "uncollected").toLowerCase();
    byMethod[method] ??= { count: 0, amount: 0 };
    byMethod[method].count += 1;
    byMethod[method].amount = round2(byMethod[method].amount + num(o.total));
  }

  const byType: Record<string, { count: number; amount: number }> = {};
  for (const o of settled) {
    const type = String(o.type ?? "dine_in");
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
    lte(cashShiftsTable.openedAt, bounds.end),
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
      total: sum(settled, "total"),
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
