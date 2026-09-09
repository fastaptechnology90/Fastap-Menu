import { Router, type IRouter } from "express";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { db, ordersTable, cashShiftsTable, dayClosuresTable, restaurantsTable } from "@workspace/db";
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
 *
 * Z used to be a second GET over the same calculation, so it was byte-identical to X, could
 * be taken twenty times with the same answer, and closed nothing — which meant a day the
 * manager had signed off could still change afterwards. Closing a day is now an explicit
 * POST that freezes the report into `day_closures`; every later read of a closed day returns
 * that frozen copy rather than a fresh calculation.
 */

const router: IRouter = Router();

/**
 * A restaurant's day runs past midnight, so a business day is offset rather than a calendar
 * one.
 *
 * It used to run midnight to midnight regardless. A venue that closes at 23:00 routinely
 * settles its last tables after midnight — normal in India — and every one of those bills
 * landed on the NEXT day's report, so Saturday night's takings were split across two
 * readings and neither matched what the manager had counted. The day now rolls over a
 * couple of hours after the venue closes, which is when the till is genuinely finished.
 */
const ROLLOVER_GRACE_HOURS = 3;

function rolloverHourFor(closeTime: string | null | undefined): number {
  const match = String(closeTime ?? "23:00").match(/^(\d{1,2}):(\d{2})/);
  const closeHour = match ? parseInt(match[1], 10) : 23;
  // A venue closing at 23:00 rolls over at 02:00; one closing at 02:00 rolls at 05:00.
  return (closeHour + ROLLOVER_GRACE_HOURS) % 24;
}

function dayBounds(dateStr: string | undefined, rolloverHour = 0) {
  const now = new Date();
  let base: Date;
  if (dateStr) {
    base = new Date(`${dateStr}T00:00:00`);
  } else {
    // Before the rollover hour we are still working yesterday's business day.
    base = new Date(now);
    if (rolloverHour > 0 && now.getHours() < rolloverHour) base.setDate(base.getDate() - 1);
  }
  if (Number.isNaN(base.getTime())) return null;
  const start = new Date(base);
  start.setHours(rolloverHour, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // Label the day the restaurant is actually in. toISOString() would report the UTC date,
  // which in India is the previous day for every reading taken before 5:30am — the report
  // would be headed with yesterday's date while covering today's takings.
  const label = [
    base.getFullYear(),
    String(base.getMonth() + 1).padStart(2, "0"),
    String(base.getDate()).padStart(2, "0"),
  ].join("-");
  return { start, end, label };
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

async function buildReport(restaurantId: number, dateStr: string | undefined) {
  const [venue] = await db.select({ closeTime: restaurantsTable.closeTime })
    .from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId)).limit(1);
  const bounds = dayBounds(dateStr, rolloverHourFor(venue?.closeTime));
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

  // Who took the money, and separately who served the table. Every settled order in the
  // venue used to be credited to one waiter, because only `waiterName` was read — while the
  // payment record on the same order named a different person as having collected it. Any
  // commission or performance conversation then started from a false premise.
  const collectorOf = (o: typeof orders[number]) => {
    const meta = (typeof o.metadata === "object" && o.metadata !== null ? o.metadata : {}) as Record<string, unknown>;
    const pay = (typeof meta.payment === "object" && meta.payment !== null ? meta.payment : {}) as Record<string, unknown>;
    const who = pay.collectedBy ?? pay.performedBy ?? meta.collectedBy;
    return typeof who === "string" && who.trim() ? who.trim() : null;
  };

  const byStaff: Record<string, { orders: number; amount: number }> = {};
  const byCollector: Record<string, { orders: number; amount: number }> = {};
  for (const o of settled) {
    const served = o.waiterName ?? "unassigned";
    byStaff[served] ??= { orders: 0, amount: 0 };
    byStaff[served].orders += 1;
    byStaff[served].amount = round2(byStaff[served].amount + num(o.total));

    const took = collectorOf(o) ?? o.waiterName ?? "unattributed";
    byCollector[took] ??= { orders: 0, amount: 0 };
    byCollector[took].orders += 1;
    byCollector[took].amount = round2(byCollector[took].amount + num(o.total));
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

  // Only a shift somebody actually counted can be reconciled. `closingBalance` is null on a
  // shift that was closed without a count, and the old sum treated that null as a zero
  // count — so an uncounted shift reported the drawer short by its entire opening float, on
  // top of the day's cash. That is the "variance = minus the day's takings" figure that
  // accused a cashier of theft every night. Uncounted shifts are now excluded from both
  // sides of the comparison and reported separately, by name, so they are chased rather
  // than silently booked as a shortfall.
  const isCounted = (s: typeof shifts[number]) =>
    s.closingBalance !== null && Number.isFinite(parseFloat(String(s.closingBalance)));
  const counted = shifts.filter(isCounted);
  const uncounted = shifts.filter(s => s.closedAt && !isCounted(s));

  const drawerCounted = round2(counted.reduce((t, s) => t + num(s.closingBalance), 0));
  const drawerOpening = round2(counted.reduce((t, s) => t + num(s.openingBalance), 0));
  // What the drawer should hold: the float plus what the till itself recorded taking, less
  // what was paid out of it. Comparing the count against this rather than against the
  // day's order total is what makes the variance mean "the drawer is short", because both
  // sides then come from the same shift.
  const drawerExpected = round2(counted.reduce(
    (t, s) => t + num(s.openingBalance) + num(s.cashSales) - num(s.cashExpenses), 0));
  const shiftCashSales = round2(shifts.reduce((t, s) => t + num(s.cashSales), 0));

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
    /** Keyed on who actually took the payment, which is not always who served the table. */
    byCollector,
    adjustments: adjustmentTotals,
    cash: {
      takenPerOrders: cashTaken,
      // What the shift records themselves say was taken in cash. The two halves of cashing
      // up were computed from different places and never compared; a difference here means
      // cash was taken outside an open shift, or a shift was left running across days.
      recordedInShifts: shiftCashSales,
      drawerOpening,
      drawerCounted,
      drawerExpected,
      // Positive means the drawer holds more than the shift accounts for.
      variance: round2(drawerCounted - drawerExpected),
      shiftsOpen: shifts.filter(s => !s.closedAt).length,
      shiftsCounted: counted.length,
      shiftsUncounted: uncounted.length,
      uncountedShifts: uncounted.map(s => ({ id: s.id, staffName: s.staffName, cashSales: num(s.cashSales) })),
      mismatchShifts: counted.filter(s => s.mismatchAlert).map(s => ({
        id: s.id,
        staffName: s.staffName,
        expected: num(s.expectedBalance),
        counted: num(s.closingBalance),
        difference: round2(num(s.closingBalance) - num(s.expectedBalance)),
      })),
      reconciles: Math.abs(round2(cashTaken - shiftCashSales)) < 0.01,
    },
  };
}

function actorOf(req: { session: { staffSession?: { staffName?: string } ; userId?: number } }): string {
  return req.session.staffSession?.staffName ?? "staff";
}

/** The frozen reading for a day that has already been closed, or null while it is still open. */
async function storedClosure(restaurantId: number, businessDate: string) {
  const [row] = await db.select().from(dayClosuresTable).where(and(
    eq(dayClosuresTable.restaurantId, restaurantId),
    eq(dayClosuresTable.businessDate, businessDate),
  ));
  return row ?? null;
}

/** X reading — where the day stands right now. Safe to take as often as you like. */
router.get("/restaurants/:restaurantId/reports/x", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const report = await buildReport(restaurantId, req.query.date as string | undefined);
  if (!report) { res.status(400).json({ error: "Invalid date" }); return; }
  const closure = await storedClosure(restaurantId, report.date);
  // An X taken after the day is closed still shows live figures, but says so — otherwise a
  // manager cannot tell a provisional look from the reading they signed off.
  res.json({ reading: "X", closed: Boolean(closure), ...report });
});

/**
 * Z reading — the closing figures for a business day.
 *
 * Once the day is closed this returns the snapshot taken at that moment, so it answers the
 * same way however often it is asked. While the day is still open it returns the live
 * figures marked `closed: false`, which is a provisional look, not a close: closing is
 * POST /reports/z/close.
 */
router.get("/restaurants/:restaurantId/reports/z", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const [venue] = await db.select({ closeTime: restaurantsTable.closeTime })
    .from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId)).limit(1);
  const bounds = dayBounds(req.query.date as string | undefined, rolloverHourFor(venue?.closeTime));
  if (!bounds) { res.status(400).json({ error: "Invalid date" }); return; }

  const closure = await storedClosure(restaurantId, bounds.label);
  if (closure) {
    res.json({
      reading: "Z",
      closed: true,
      zNumber: closure.zNumber,
      closedAt: closure.closedAt,
      closedBy: closure.closedBy,
      ...(closure.report as Record<string, unknown>),
    });
    return;
  }

  const report = await buildReport(restaurantId, req.query.date as string | undefined);
  if (!report) { res.status(400).json({ error: "Invalid date" }); return; }

  if (report.cash.shiftsOpen > 0 && req.query.force !== "true") {
    res.status(409).json({
      error: `${report.cash.shiftsOpen} cash shift(s) are still open. Close them before taking the Z reading, or pass force=true to read anyway.`,
      shiftsOpen: report.cash.shiftsOpen,
    });
    return;
  }

  res.json({ reading: "Z", closed: false, ...report });
});

/**
 * Close the business day. This is the half a Z reading was missing: it freezes the report,
 * so the figures a manager signs off can no longer move, and refuses while the drawer is
 * unaccounted for — an open shift, or one closed without anybody counting it.
 */
router.post("/restaurants/:restaurantId/reports/z/close", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const [venue] = await db.select({ closeTime: restaurantsTable.closeTime })
    .from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId)).limit(1);
  const bounds = dayBounds(req.body?.date ?? (req.query.date as string | undefined), rolloverHourFor(venue?.closeTime));
  if (!bounds) { res.status(400).json({ error: "Invalid date" }); return; }

  const existing = await storedClosure(restaurantId, bounds.label);
  if (existing) {
    // A day closes once. Re-running Z used to hand back a fresh calculation as if it were a
    // second close; now the original reading is returned and identified as such.
    res.status(409).json({
      error: `${bounds.label} was already closed (Z-${existing.zNumber}) at ${new Date(existing.closedAt).toISOString()}.`,
      zNumber: existing.zNumber,
      closedAt: existing.closedAt,
      closedBy: existing.closedBy,
    });
    return;
  }

  const report = await buildReport(restaurantId, bounds.label);
  if (!report) { res.status(400).json({ error: "Invalid date" }); return; }

  if (report.cash.shiftsOpen > 0) {
    res.status(409).json({
      error: `${report.cash.shiftsOpen} cash shift(s) are still open. Count and close the drawer before closing the day.`,
      shiftsOpen: report.cash.shiftsOpen,
    });
    return;
  }
  if (report.cash.shiftsUncounted > 0) {
    res.status(409).json({
      error: `${report.cash.shiftsUncounted} shift(s) were closed without the drawer being counted. Record the count before closing the day.`,
      uncountedShifts: report.cash.uncountedShifts,
    });
    return;
  }

  const [last] = await db.select().from(dayClosuresTable)
    .where(eq(dayClosuresTable.restaurantId, restaurantId))
    .orderBy(desc(dayClosuresTable.zNumber))
    .limit(1);
  const zNumber = (last?.zNumber ?? 0) + 1;

  const [closure] = await db.insert(dayClosuresTable).values({
    restaurantId,
    businessDate: bounds.label,
    zNumber,
    report,
    closedBy: actorOf(req),
  }).returning();

  res.status(201).json({
    reading: "Z",
    closed: true,
    zNumber: closure.zNumber,
    closedAt: closure.closedAt,
    closedBy: closure.closedBy,
    ...report,
  });
});

/** The days this venue has closed, newest first — the audit trail of Z readings. */
router.get("/restaurants/:restaurantId/reports/z/closures", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const rows = await db.select().from(dayClosuresTable)
    .where(eq(dayClosuresTable.restaurantId, restaurantId))
    .orderBy(desc(dayClosuresTable.zNumber))
    .limit(60);
  res.json(rows.map(r => ({
    zNumber: r.zNumber,
    businessDate: r.businessDate,
    closedAt: r.closedAt,
    closedBy: r.closedBy,
    total: (r.report as { sales?: { total?: number } })?.sales?.total ?? 0,
  })));
});

export default router;
