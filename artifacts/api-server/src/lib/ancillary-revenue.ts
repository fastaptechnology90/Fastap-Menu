import { and, eq, gte, lte } from "drizzle-orm";
import { db, spaBookingsTable, banquetEventsTable } from "@workspace/db";
import { parseMoney, roundMoney } from "./payment-calculations.js";

// Spa/bar revenue lives in its own table (not ordersTable), so it was never part of the
// restaurant's overall revenue. Client: "spa hoga to restaurant ke andar hi hai — 8.5k
// restaurant total me add kyu nahi ho raha". This folds realised spa revenue into the
// same totals every panel shows. Cancelled / no-show bookings don't count.
const SPA_COUNTED = new Set(["booked", "confirmed", "in_progress", "completed"]);

// One query → spa revenue for every restaurant, grouped. Avoids an N+1 (one spa query
// per restaurant) on the platform-wide "restaurant revenues" list.
export async function getSpaRevenueByRestaurant(): Promise<Map<number, number>> {
  const rows = await db
    .select({ restaurantId: spaBookingsTable.restaurantId, price: spaBookingsTable.price, status: spaBookingsTable.status })
    .from(spaBookingsTable);
  const map = new Map<number, number>();
  for (const r of rows) {
    if (!SPA_COUNTED.has(String(r.status ?? "").toLowerCase())) continue;
    map.set(r.restaurantId, (map.get(r.restaurantId) ?? 0) + parseMoney(r.price));
  }
  for (const [k, v] of map) map.set(k, roundMoney(v));
  return map;
}

// Spa revenue for ONE restaurant summed for each "since" boundary — one query instead of
// one per date bucket (today / week / fortnight / month on the owner dashboard).
export async function getSpaRevenueBuckets(restaurantId: number, sinces: (Date | null)[]): Promise<number[]> {
  const rows = await db
    .select({ price: spaBookingsTable.price, status: spaBookingsTable.status, createdAt: spaBookingsTable.createdAt })
    .from(spaBookingsTable)
    .where(eq(spaBookingsTable.restaurantId, restaurantId));
  const counted = rows.filter(r => SPA_COUNTED.has(String(r.status ?? "").toLowerCase()));
  return sinces.map(since =>
    roundMoney(counted.filter(r => !since || new Date(r.createdAt) >= since).reduce((s, r) => s + parseMoney(r.price), 0)),
  );
}

export async function getSpaRevenue(
  restaurantId: number | null,
  from?: Date | null,
  to?: Date | null,
): Promise<number> {
  const conds = [];
  if (restaurantId) conds.push(eq(spaBookingsTable.restaurantId, restaurantId));
  if (from) conds.push(gte(spaBookingsTable.createdAt, from));
  if (to) conds.push(lte(spaBookingsTable.createdAt, to));
  const rows = await db
    .select({ price: spaBookingsTable.price, status: spaBookingsTable.status })
    .from(spaBookingsTable)
    .where(conds.length ? and(...conds) : undefined);
  return roundMoney(
    rows.filter(r => SPA_COUNTED.has(String(r.status ?? "").toLowerCase()))
      .reduce((s, r) => s + parseMoney(r.price), 0),
  );
}

// Events & Banquet revenue lives in its own table (advance collected against a booking).
// Fold the collected advance into the same totals — cancelled events don't count.
export async function getBanquetRevenue(
  restaurantId: number | null,
  from: Date | null,
  to: Date | null,
): Promise<number> {
  const conds = [];
  if (restaurantId != null) conds.push(eq(banquetEventsTable.restaurantId, restaurantId));
  if (from) conds.push(gte(banquetEventsTable.createdAt, from));
  if (to) conds.push(lte(banquetEventsTable.createdAt, to));
  const rows = await db
    .select({ advancePaid: banquetEventsTable.advancePaid, status: banquetEventsTable.status })
    .from(banquetEventsTable)
    .where(conds.length ? and(...conds) : undefined);
  return roundMoney(
    rows.filter(r => String(r.status ?? "").toLowerCase() !== "cancelled")
      .reduce((s, r) => s + parseMoney(r.advancePaid), 0),
  );
}

// One query → banquet advance revenue for every restaurant (for the platform list).
export async function getBanquetRevenueByRestaurant(): Promise<Map<number, number>> {
  const rows = await db
    .select({ restaurantId: banquetEventsTable.restaurantId, advancePaid: banquetEventsTable.advancePaid, status: banquetEventsTable.status })
    .from(banquetEventsTable);
  const map = new Map<number, number>();
  for (const r of rows) {
    if (String(r.status ?? "").toLowerCase() === "cancelled") continue;
    map.set(r.restaurantId, (map.get(r.restaurantId) ?? 0) + parseMoney(r.advancePaid));
  }
  return map;
}
