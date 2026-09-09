import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { makeStaffQrToken } from "../lib/mobile-kitchen/staff-tokens.js";
import {
  getStaffSalesMap, getStaffCommissionTotals, getStaffCommissionPolicy,
  commissionPercentFor, emptyStaffSales,
} from "../lib/staff-earnings.js";

const router: IRouter = Router();

/**
 * Payroll figures are stored as a decimal string, and an empty box means "no salary set"
 * rather than zero. Returns "invalid" for anything that is neither.
 */
function salaryToStore(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n.toFixed(2);
}

/**
 * Staff rows carry what each person actually sold.
 *
 * Screens wanting a server's sales had no field to read and were inferring it from a
 * commission amount, which measures the rate rather than the sales. These figures come
 * from the orders that person closed, under the same paid-only rule as revenue, so a
 * server's total and the venue's revenue reconcile against each other.
 *
 * `performanceScore` is whatever a manager stored on the record; nothing measures it, so
 * `hasMeasuredPerformance` says plainly that it is not derived from the data below.
 */
router.get("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const rows = await db.select().from(staffTable).where(eq(staffTable.restaurantId, id));

  const [sales, commissionTotals, policy] = await Promise.all([
    getStaffSalesMap(id),
    getStaffCommissionTotals(id, rows.map(r => r.name)),
    getStaffCommissionPolicy(id),
  ]);

  res.json(rows.map(({ pinHash: _pinHash, ...rest }) => {
    const nameKey = String(rest.name ?? "").trim().toLowerCase();
    const mine = sales.byId.get(rest.id) ?? sales.byName.get(nameKey) ?? emptyStaffSales();
    const earned = commissionTotals.get(nameKey) ?? { accrued: 0, paid: 0, tips: 0 };
    const percent = commissionPercentFor(policy, rest.role);
    return {
      ...rest,
      ordersServed: mine.ordersServed,
      salesTotal: mine.salesTotal,
      avgOrderValue: mine.avgOrderValue,
      tipsCollected: mine.tipsCollected,
      lastOrderAt: mine.lastOrderAt,
      commissionAccrued: earned.accrued,
      commissionPaid: earned.paid,
      commissionPending: Math.round((earned.accrued - earned.paid) * 100) / 100,
      commissionPercent: percent > 0 ? percent : null,
      hasMeasuredPerformance: false,
    };
  }));
});

router.post("/restaurants/:restaurantId/staff", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { name, email, role, phone, password, isActive, salary, shift } = req.body;
  if (!name?.trim() || !email?.trim() || !role) {
    res.status(400).json({ error: "name, email, and role are required" });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: "password (6+ characters) is required for staff login" });
    return;
  }
  const salaryValue = salaryToStore(salary);
  if (salaryValue === "invalid") { res.status(400).json({ error: "Salary must be a positive amount." }); return; }
  const pinHash = await bcrypt.hash(String(password), 10);
  const [member] = await db
    .insert(staffTable)
    .values({
      restaurantId: id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).replace(/\D/g, "") : null,
      role,
      pinHash,
      isActive: isActive ?? true,
      // The column, the payroll figure the staff list displays, and the `edit_salary`
      // permission all existed; nothing ever wrote one. A venue could type a salary when
      // adding someone and it was dropped on the way to the database.
      salary: salaryValue,
      shift: shift ? String(shift) : undefined,
      joinDate: new Date(),
    })
    .returning();
  const { pinHash: _h, ...safe } = member;
  res.status(201).json(safe);
});

router.put("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(String(req.params.staffId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { name, email, role, phone, password, isActive, shift, weeklySchedule, salary } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = String(email).trim().toLowerCase();
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone ? String(phone).replace(/\D/g, "") : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (shift !== undefined) updates.shift = shift ? String(shift) : "morning"; // HR can change a staff member's shift
  // HR day-wise roster: { Mon: "Night", Tue: "Morning", ..., Sun: "Off" }
  if (weeklySchedule !== undefined && weeklySchedule && typeof weeklySchedule === "object") {
    updates.weeklySchedule = weeklySchedule;
  }
  if (salary !== undefined) {
    const salaryValue = salaryToStore(salary);
    if (salaryValue === "invalid") { res.status(400).json({ error: "Salary must be a positive amount." }); return; }
    updates.salary = salaryValue;
  }
  if (password) {
    if (String(password).length < 6) {
      res.status(400).json({ error: "password must be at least 6 characters" });
      return;
    }
    updates.pinHash = await bcrypt.hash(String(password), 10);
  }
  const [member] = await db
    .update(staffTable)
    .set(updates)
    .where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId)))
    .returning();
  if (!member) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }
  const { pinHash: _h, ...safe } = member;
  res.json(safe);
});

router.delete("/restaurants/:restaurantId/staff/:staffId", requireAuth, async (req, res): Promise<void> => {
  const staffId = parseInt(String(req.params.staffId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const [deleted] = await db
    .delete(staffTable)
    .where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Staff not found" });
    return;
  }
  res.json({ message: "Staff removed" });
});

/**
 * Mint the token behind a staff QR login code.
 *
 * The app's QR login used to accept a bare staff code, which is printed on rosters —
 * so anyone who could read a badge could sign in as that person. It now only accepts a
 * token signed here, which means a manager who is already signed in has to hand it over.
 * The token is deliberately short-lived: it is meant to be scanned off a screen there
 * and then, not saved or forwarded.
 */
router.post(
  "/restaurants/:restaurantId/staff/:staffId/login-qr",
  requireAuth,
  async (req, res): Promise<void> => {
    const restaurantId = parseInt(String(req.params.restaurantId), 10);
    const staffId = parseInt(String(req.params.staffId), 10);
    if (!Number.isFinite(restaurantId) || !Number.isFinite(staffId)) {
      res.status(400).json({ error: "Invalid restaurant or staff id" });
      return;
    }

    const [member] = await db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.id, staffId), eq(staffTable.restaurantId, restaurantId)))
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    if (!member.isActive) {
      res.status(409).json({ error: "This staff member is deactivated." });
      return;
    }

    res.json({
      qrToken: makeStaffQrToken(member.id),
      expiresInSeconds: 600,
      staff: { id: member.id, name: member.name, role: member.role },
    });
  },
);

export default router;
