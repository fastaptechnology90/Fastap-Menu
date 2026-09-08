import { eq, and, inArray } from "drizzle-orm";
import { db, ordersTable, staffCommissionsTable } from "@workspace/db";
import { isPaidOrder, orderCommissionBase, orderGrossTotal, roundMoney } from "./payment-calculations.js";
import { getRestaurantSettings } from "./restaurant-settings.js";

/**
 * What a staff member earned, and what they sold, from the orders they actually served.
 *
 * Two separate problems lived here. Nothing ever wrote a `staff_commissions` row from a
 * real order — every row in the table was seed data with no `orderId` — so the commission
 * screen had nothing order-linked to show. And "sales" was being reconstructed by
 * multiplying a commission amount by a constant, which is not a measurement of anything:
 * it moved when the commission rate changed and stayed still when sales did.
 *
 * Sales are read straight off the orders a server closed. Commission is only accrued when
 * the venue has actually set a rate — a venue that pays no commission should see nothing,
 * not a plausible figure derived from an unrelated column.
 */

type OrderRow = typeof ordersTable.$inferSelect;

export type StaffCommissionPolicy = {
  /** Percent of the order's pre-tax value paid to the server. 0 (or unset) means none. */
  percent: number;
  /** Optional per-role override, e.g. { waiter: 2, bar: 3 }. */
  byRole: Record<string, number>;
  /** Whether a tip belongs to the server who closed the table. Defaults to true. */
  tipsToServer: boolean;
};

function toPercent(value: unknown): number {
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 0;
}

export async function getStaffCommissionPolicy(restaurantId: number): Promise<StaffCommissionPolicy> {
  const settings = await getRestaurantSettings(restaurantId);
  const staff = (settings.staff && typeof settings.staff === "object" ? settings.staff : {}) as Record<string, unknown>;
  const rawByRole = (staff.commissionByRole && typeof staff.commissionByRole === "object"
    ? staff.commissionByRole
    : {}) as Record<string, unknown>;
  const byRole: Record<string, number> = {};
  for (const [role, value] of Object.entries(rawByRole)) {
    const pct = toPercent(value);
    if (pct > 0) byRole[role.toLowerCase()] = pct;
  }
  return {
    percent: toPercent(staff.commissionPercent),
    byRole,
    tipsToServer: staff.tipsToServer !== false,
  };
}

export function commissionPercentFor(policy: StaffCommissionPolicy, role: string | null | undefined): number {
  const key = String(role ?? "").toLowerCase();
  return policy.byRole[key] ?? policy.percent;
}

/**
 * Book what the server earned on one order, once it is paid.
 *
 * Called from the same place the finance ledger is written, so a payment taken in the
 * app and a payment taken on the web both accrue. It de-duplicates on (order, type) and
 * never throws: a bookkeeping problem must not fail a payment that already happened.
 */
export async function accrueStaffEarningsForOrder(opts: {
  restaurantId: number;
  order: OrderRow;
  staffRole?: string | null;
}): Promise<void> {
  const { restaurantId, order } = opts;
  try {
    if (!isPaidOrder(order)) return;
    const serverName = (order.waiterName ?? "").trim();
    const serverId = order.waiterId ?? null;
    if (!serverName && serverId == null) return;

    const policy = await getStaffCommissionPolicy(restaurantId);
    const role = opts.staffRole ?? "waiter";
    const percent = commissionPercentFor(policy, role);
    const tip = parseFloat(String(order.tipAmount ?? 0)) || 0;

    const wanted: { type: string; amount: number; percentage: number | null; description: string }[] = [];
    if (percent > 0) {
      const amount = roundMoney(orderCommissionBase(order) * (percent / 100));
      if (amount > 0) {
        wanted.push({
          type: "sales",
          amount,
          percentage: percent,
          description: `Order #${order.id}${order.tableName ? ` · ${order.tableName}` : ""}`,
        });
      }
    }
    if (policy.tipsToServer && tip > 0) {
      wanted.push({
        type: "tip",
        amount: roundMoney(tip),
        percentage: null,
        description: `Tip on order #${order.id}${order.tableName ? ` · ${order.tableName}` : ""}`,
      });
    }
    if (!wanted.length) return;

    const existing = await db.select({ type: staffCommissionsTable.type })
      .from(staffCommissionsTable)
      .where(and(
        eq(staffCommissionsTable.restaurantId, restaurantId),
        eq(staffCommissionsTable.orderId, order.id),
      ));
    const already = new Set(existing.map(r => String(r.type)));

    const month = new Date(order.createdAt).toISOString().slice(0, 7);
    const rows = wanted
      .filter(w => !already.has(w.type))
      .map(w => ({
        restaurantId,
        staffId: serverId,
        staffName: serverName || `Staff #${serverId}`,
        staffRole: role,
        type: w.type,
        orderId: order.id,
        amount: String(w.amount.toFixed(2)),
        percentage: w.percentage != null ? String(w.percentage) : null,
        description: w.description,
        month,
      }));
    if (rows.length) await db.insert(staffCommissionsTable).values(rows);
  } catch {
    // Deliberately swallowed — see the note above.
  }
}

export type StaffSales = {
  ordersServed: number;
  salesTotal: number;
  avgOrderValue: number | null;
  tipsCollected: number;
  lastOrderAt: string | null;
};

function emptySales(): StaffSales {
  return { ordersServed: 0, salesTotal: 0, avgOrderValue: null, tipsCollected: 0, lastOrderAt: null };
}

export function emptyStaffSales(): StaffSales {
  return emptySales();
}

/**
 * Real sales per staff member, keyed by staff id and (for orders that only recorded a
 * name) by lower-cased name. Only paid orders count, the same rule revenue uses, so a
 * server's total and the venue's revenue can be reconciled against each other.
 */
export async function getStaffSalesMap(
  restaurantId: number,
  since?: Date,
): Promise<{ byId: Map<number, StaffSales>; byName: Map<string, StaffSales> }> {
  const orders = await db.select({
    waiterId: ordersTable.waiterId,
    waiterName: ordersTable.waiterName,
    total: ordersTable.total,
    subtotal: ordersTable.subtotal,
    tipAmount: ordersTable.tipAmount,
    paymentStatus: ordersTable.paymentStatus,
    status: ordersTable.status,
    createdAt: ordersTable.createdAt,
  }).from(ordersTable).where(eq(ordersTable.restaurantId, restaurantId));

  const byId = new Map<number, StaffSales>();
  const byName = new Map<string, StaffSales>();

  const add = (cur: StaffSales, o: typeof orders[number]): StaffSales => {
    cur.ordersServed += 1;
    cur.salesTotal = roundMoney(cur.salesTotal + orderGrossTotal(o));
    cur.tipsCollected = roundMoney(cur.tipsCollected + (parseFloat(String(o.tipAmount ?? 0)) || 0));
    const at = new Date(o.createdAt).toISOString();
    if (!cur.lastOrderAt || at > cur.lastOrderAt) cur.lastOrderAt = at;
    cur.avgOrderValue = roundMoney(cur.salesTotal / cur.ordersServed);
    return cur;
  };

  for (const o of orders) {
    if (!isPaidOrder(o)) continue;
    if (since && new Date(o.createdAt) < since) continue;
    if (o.waiterId != null) byId.set(o.waiterId, add(byId.get(o.waiterId) ?? emptySales(), o));
    const name = (o.waiterName ?? "").trim().toLowerCase();
    if (name) byName.set(name, add(byName.get(name) ?? emptySales(), o));
  }
  return { byId, byName };
}

/** Commission booked against staff, split into what is still owed and what is already paid. */
export async function getStaffCommissionTotals(restaurantId: number, staffNames: string[]) {
  const rows = await db.select().from(staffCommissionsTable)
    .where(staffNames.length
      ? and(eq(staffCommissionsTable.restaurantId, restaurantId), inArray(staffCommissionsTable.staffName, staffNames))
      : eq(staffCommissionsTable.restaurantId, restaurantId));
  const byName = new Map<string, { accrued: number; paid: number; tips: number }>();
  for (const r of rows) {
    const key = String(r.staffName ?? "").trim().toLowerCase();
    if (!key) continue;
    const cur = byName.get(key) ?? { accrued: 0, paid: 0, tips: 0 };
    const amount = parseFloat(String(r.amount ?? 0)) || 0;
    if (String(r.type) === "tip") cur.tips = roundMoney(cur.tips + amount);
    else cur.accrued = roundMoney(cur.accrued + amount);
    if (String(r.status) === "paid") cur.paid = roundMoney(cur.paid + amount);
    byName.set(key, cur);
  }
  return byName;
}
