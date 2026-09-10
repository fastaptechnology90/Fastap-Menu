import { Router, type IRouter } from "express";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { db, staffAttendanceTable, staffTable, ordersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { round2 } from "../lib/order-pricing.js";
import { logger } from "../lib/logger.js";
import { isPaidOrder } from "../lib/payment-calculations.js";

/**
 * Clock in, clock out, and who is on the floor.
 *
 * The staff screen carried an attendance tab that was a permanent placeholder, and the
 * only record of a shift was a single word on the staff row — "morning". So nobody could
 * answer who worked yesterday, for how long, or what they sold, which is exactly what
 * payroll and commission are calculated from.
 *
 * A shift is one row: opened on clock-in, closed on clock-out with the hours and the
 * takings recorded then rather than derived later, so a corrected row stays corrected.
 */

const router: IRouter = Router();

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Who is clocked in right now. */
router.get("/restaurants/:restaurantId/attendance/open", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const rows = await db.select().from(staffAttendanceTable).where(and(
    eq(staffAttendanceTable.restaurantId, restaurantId),
    isNull(staffAttendanceTable.clockedOutAt),
  )).orderBy(desc(staffAttendanceTable.clockedInAt));
  res.json(rows);
});

/** Shifts over a period — what a payroll run reads. */
router.get("/restaurants/:restaurantId/attendance", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }
  to.setHours(23, 59, 59, 999);

  const rows = await db.select().from(staffAttendanceTable).where(and(
    eq(staffAttendanceTable.restaurantId, restaurantId),
    gte(staffAttendanceTable.clockedInAt, from),
    lte(staffAttendanceTable.clockedInAt, to),
  )).orderBy(desc(staffAttendanceTable.clockedInAt));

  // Per person, which is how the report is read — not shift by shift.
  const perStaff: Record<string, { staffId: number; name: string; role: string; shifts: number; minutes: number; sales: number }> = {};
  for (const r of rows) {
    const key = String(r.staffId);
    perStaff[key] ??= { staffId: r.staffId, name: r.staffName, role: r.staffRole, shifts: 0, minutes: 0, sales: 0 };
    perStaff[key].shifts += 1;
    perStaff[key].minutes += Math.max(0, (r.minutesWorked ?? 0) - r.breakMinutes);
    perStaff[key].sales = round2(perStaff[key].sales + num(r.salesDuringShift));
  }

  res.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    shifts: rows,
    summary: Object.values(perStaff).map(s => ({
      ...s,
      hours: round2(s.minutes / 60),
    })),
  });
});

/** Clock in. Refuses a second open shift, which is how double-counted hours start. */
router.post("/restaurants/:restaurantId/attendance/clock-in", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { staffId, method } = req.body ?? {};

  const id = Number(staffId ?? req.session.staffSession?.staffId);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "staffId is required" }); return; }

  const [member] = await db.select().from(staffTable)
    .where(and(eq(staffTable.id, id), eq(staffTable.restaurantId, restaurantId)));
  if (!member) { res.status(404).json({ error: "Staff member not found at this venue" }); return; }
  if (!member.isActive) { res.status(409).json({ error: "This staff member is deactivated." }); return; }

  const [open] = await db.select().from(staffAttendanceTable).where(and(
    eq(staffAttendanceTable.staffId, id),
    isNull(staffAttendanceTable.clockedOutAt),
  ));
  if (open) {
    res.status(409).json({
      error: `${member.name} is already clocked in since ${new Date(open.clockedInAt).toLocaleTimeString("en-IN")}.`,
      shift: open,
    });
    return;
  }

  const [shift] = await db.insert(staffAttendanceTable).values({
    restaurantId,
    staffId: id,
    staffName: member.name,
    staffRole: member.role,
    clockInMethod: method ? String(method) : "panel",
  }).returning();

  logger.info({ restaurantId, staffId: id, name: member.name }, "staff clocked in");
  res.status(201).json(shift);
});

/**
 * Clock out. The hours and the shift's takings are worked out here and stored, so the
 * figure a payroll run reads cannot drift as orders are later edited.
 */
router.post("/restaurants/:restaurantId/attendance/clock-out", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { staffId, breakMinutes, notes } = req.body ?? {};

  const id = Number(staffId ?? req.session.staffSession?.staffId);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "staffId is required" }); return; }

  const [open] = await db.select().from(staffAttendanceTable).where(and(
    eq(staffAttendanceTable.restaurantId, restaurantId),
    eq(staffAttendanceTable.staffId, id),
    isNull(staffAttendanceTable.clockedOutAt),
  ));
  if (!open) { res.status(409).json({ error: "That staff member is not clocked in." }); return; }

  const out = new Date();
  const minutes = Math.max(0, Math.round((out.getTime() - new Date(open.clockedInAt).getTime()) / 60000));

  // What this person sold while they were on — the only honest basis for commission.
  const sold = await db.select().from(ordersTable).where(and(
    eq(ordersTable.restaurantId, restaurantId),
    gte(ordersTable.createdAt, new Date(open.clockedInAt)),
    lte(ordersTable.createdAt, out),
  ));
  const theirs = sold.filter(o =>
    (o.waiterName ?? "").toLowerCase() === open.staffName.toLowerCase()
    && isPaidOrder(o));
  const sales = round2(theirs.reduce((t, o) => t + num(o.total), 0));

  const [closed] = await db.update(staffAttendanceTable).set({
    clockedOutAt: out,
    minutesWorked: minutes,
    breakMinutes: Number.isFinite(Number(breakMinutes)) ? Math.max(0, Number(breakMinutes)) : 0,
    salesDuringShift: sales.toFixed(2),
    notes: notes ? String(notes) : null,
  }).where(eq(staffAttendanceTable.id, open.id)).returning();

  logger.info({ restaurantId, staffId: id, minutes, sales }, "staff clocked out");
  res.json({ ...closed, hours: round2(minutes / 60) });
});

export default router;
