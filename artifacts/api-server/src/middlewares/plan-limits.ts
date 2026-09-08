import { type Request, type Response, type NextFunction } from "express";
import { eq, and, count, gte } from "drizzle-orm";
import {
  db, restaurantsTable, platformPlansTable, staffTable, tablesMapTable,
  menuItemsTable, branchesTable, ordersTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";

/**
 * Hold a venue to the plan it is paying for.
 *
 * The plans table has carried maxStaff, maxTables, maxItems, maxBranches and
 * maxOrdersPerMonth from the beginning, the Plans screen advertises them, and nothing
 * ever read them: a venue on the free plan, whose limit is two staff, had thirteen. Every
 * paid tier was therefore optional — a customer could sign up on the free plan and use
 * the whole product.
 *
 * Only *creating* is limited. Reading, editing and deleting stay open, because a venue
 * that has gone over its limit (or been downgraded onto a smaller one) must still be able
 * to work with and reduce what it already has. Locking them out of their own data to
 * enforce a billing rule would be the wrong trade.
 */

type LimitRule = {
  path: RegExp;
  /** The column on the plan that caps this. */
  limit: "maxStaff" | "maxTables" | "maxItems" | "maxBranches";
  /** Counts what the venue already has. */
  current: (restaurantId: number) => Promise<number>;
  noun: string;
};

const under = (tail: string) => new RegExp(`^/restaurants/(\\d+)/${tail}/?$`);

async function countRows(table: Parameters<typeof db.select>[0] extends never ? never : any, restaurantId: number) {
  const [row] = await db.select({ n: count() }).from(table).where(eq(table.restaurantId, restaurantId));
  return Number(row?.n ?? 0);
}

const RULES: LimitRule[] = [
  {
    path: under("staff"), limit: "maxStaff", noun: "staff members",
    current: rid => countRows(staffTable, rid),
  },
  {
    path: under("tables"), limit: "maxTables", noun: "tables",
    current: rid => countRows(tablesMapTable, rid),
  },
  {
    path: under("items"), limit: "maxItems", noun: "menu items",
    current: rid => countRows(menuItemsTable, rid),
  },
  {
    path: under("branches"), limit: "maxBranches", noun: "branches",
    current: rid => countRows(branchesTable, rid),
  },
];

/** A plan row, or null when the venue's plan name matches nothing on the platform. */
async function planFor(restaurantId: number) {
  const [venue] = await db
    .select({ plan: restaurantsTable.plan })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  if (!venue?.plan) return null;

  const plans = await db.select().from(platformPlansTable);
  // Plan names are stored on the restaurant as free text, so match case-insensitively
  // rather than failing open on a capitalisation difference.
  return plans.find(p => p.name.toLowerCase() === String(venue.plan).toLowerCase()) ?? null;
}

export async function enforcePlanLimits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== "POST") { next(); return; }

  const rule = RULES.find(r => r.path.test(req.path));
  if (!rule) { next(); return; }

  const restaurantId = Number(rule.path.exec(req.path)?.[1]);
  if (!Number.isInteger(restaurantId)) { next(); return; }

  try {
    const plan = await planFor(restaurantId);
    // No plan on file means nothing to enforce — better to let a venue work than to
    // block it over missing billing data.
    if (!plan) { next(); return; }

    const cap = Number(plan[rule.limit] ?? 0);
    if (!Number.isFinite(cap) || cap <= 0) { next(); return; }

    const current = await rule.current(restaurantId);
    if (current < cap) { next(); return; }

    logger.info(
      { restaurantId, plan: plan.name, limit: rule.limit, cap, current },
      "plan limit reached",
    );
    res.status(402).json({
      error: `The ${plan.name} plan allows ${cap} ${rule.noun} and this venue has ${current}. Upgrade to add more.`,
      limit: { plan: plan.name, allowed: cap, current, of: rule.noun },
    });
  } catch (err) {
    // A billing check must never take the product down.
    logger.error({ err, path: req.path }, "could not check plan limits");
    next();
  }
}

/**
 * The monthly order cap, checked where an order is created rather than in middleware,
 * because it applies to the public ordering route as well as the panel.
 */
export async function monthlyOrderLimitReached(restaurantId: number): Promise<
  { reached: true; plan: string; allowed: number; used: number } | { reached: false }
> {
  try {
    const plan = await planFor(restaurantId);
    const cap = Number(plan?.maxOrdersPerMonth ?? 0);
    if (!plan || !Number.isFinite(cap) || cap <= 0) return { reached: false };

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [row] = await db
      .select({ n: count() })
      .from(ordersTable)
      .where(and(eq(ordersTable.restaurantId, restaurantId), gte(ordersTable.createdAt, monthStart)));

    const used = Number(row?.n ?? 0);
    return used >= cap
      ? { reached: true, plan: plan.name, allowed: cap, used }
      : { reached: false };
  } catch (err) {
    logger.error({ err, restaurantId }, "could not check the monthly order limit");
    return { reached: false };
  }
}
