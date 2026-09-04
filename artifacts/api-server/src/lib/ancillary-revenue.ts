import { and, eq, gte, lte } from "drizzle-orm";
import { db, spaBookingsTable, banquetEventsTable, financeTransactionsTable } from "@workspace/db";
import { parseMoney, roundMoney } from "./payment-calculations.js";

// Spa/bar revenue lives in its own table (not ordersTable), so it was never part of the
// restaurant's overall revenue. Client: "spa hoga to restaurant ke andar hi hai — 8.5k
// restaurant total me add kyu nahi ho raha". This folds realised spa revenue into the
// same totals every panel shows.
//
// Counted only once the guest has actually paid — matching orders, which are also
// cash-basis. Going by booking status meant a booking counted the moment it was
// made, so the dashboard showed spa money nobody had collected.
function spaIsPaid(row: { status?: string | null; paymentStatus?: string | null }): boolean {
  if (String(row.status ?? "").toLowerCase() === "cancelled") return false;
  const ps = String(row.paymentStatus ?? "").toLowerCase();
  return ps === "paid" || ps === "success";
}

// One query → spa revenue for every restaurant, grouped. Avoids an N+1 (one spa query
// per restaurant) on the platform-wide "restaurant revenues" list.
export async function getSpaRevenueByRestaurant(): Promise<Map<number, number>> {
  const rows = await db
    .select({ restaurantId: spaBookingsTable.restaurantId, price: spaBookingsTable.price, status: spaBookingsTable.status, paymentStatus: spaBookingsTable.paymentStatus })
    .from(spaBookingsTable);
  const map = new Map<number, number>();
  for (const r of rows) {
    if (!spaIsPaid(r)) continue;
    map.set(r.restaurantId, (map.get(r.restaurantId) ?? 0) + parseMoney(r.price));
  }
  for (const [k, v] of map) map.set(k, roundMoney(v));
  return map;
}

// Spa revenue for ONE restaurant summed for each "since" boundary — one query instead of
// one per date bucket (today / week / fortnight / month on the owner dashboard).
export async function getSpaRevenueBuckets(restaurantId: number, sinces: (Date | null)[]): Promise<number[]> {
  const rows = await db
    .select({ price: spaBookingsTable.price, status: spaBookingsTable.status, paymentStatus: spaBookingsTable.paymentStatus, createdAt: spaBookingsTable.createdAt })
    .from(spaBookingsTable)
    .where(eq(spaBookingsTable.restaurantId, restaurantId));
  const counted = rows.filter(spaIsPaid);
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
    .select({ price: spaBookingsTable.price, status: spaBookingsTable.status, paymentStatus: spaBookingsTable.paymentStatus })
    .from(spaBookingsTable)
    .where(conds.length ? and(...conds) : undefined);
  return roundMoney(
    rows.filter(spaIsPaid).reduce((s, r) => s + parseMoney(r.price), 0),
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

// Banquet advance per "since" boundary, for the owner dashboard buckets.
export async function getBanquetRevenueBuckets(restaurantId: number, sinces: (Date | null)[]): Promise<number[]> {
  const rows = await db
    .select({ advancePaid: banquetEventsTable.advancePaid, status: banquetEventsTable.status, createdAt: banquetEventsTable.createdAt })
    .from(banquetEventsTable)
    .where(eq(banquetEventsTable.restaurantId, restaurantId));
  const counted = rows.filter(r => String(r.status ?? "").toLowerCase() !== "cancelled");
  return sinces.map(since =>
    roundMoney(counted.filter(r => !since || new Date(r.createdAt) >= since).reduce((s, r) => s + parseMoney(r.advancePaid), 0)),
  );
}

/**
 * Money collected against hotel room folios — room rent plus the bar, minibar and
 * room-service charges billed to the room. It only ever lived on the room record,
 * so not a rupee of room business showed in the owner's revenue.
 *
 * Reads the finance ledger, where every folio collection is now booked, so this
 * counts what was actually collected rather than what was merely charged.
 */
export async function getRoomRevenue(
  restaurantId: number | null,
  from?: Date | null,
  to?: Date | null,
): Promise<number> {
  const conds = [
    eq(financeTransactionsTable.type, "income"),
    eq(financeTransactionsTable.category, "room_folio_payment"),
  ];
  if (restaurantId != null) conds.push(eq(financeTransactionsTable.restaurantId, restaurantId));
  if (from) conds.push(gte(financeTransactionsTable.createdAt, from));
  if (to) conds.push(lte(financeTransactionsTable.createdAt, to));
  const rows = await db
    .select({ amount: financeTransactionsTable.amount })
    .from(financeTransactionsTable)
    .where(and(...conds));
  return roundMoney(rows.reduce((s, r) => s + parseMoney(r.amount), 0));
}

export async function getRoomRevenueBuckets(restaurantId: number, sinces: (Date | null)[]): Promise<number[]> {
  const rows = await db
    .select({ amount: financeTransactionsTable.amount, createdAt: financeTransactionsTable.createdAt })
    .from(financeTransactionsTable)
    .where(and(
      eq(financeTransactionsTable.restaurantId, restaurantId),
      eq(financeTransactionsTable.type, "income"),
      eq(financeTransactionsTable.category, "room_folio_payment"),
    ));
  return sinces.map(since =>
    roundMoney(rows.filter(r => !since || new Date(r.createdAt) >= since).reduce((s, r) => s + parseMoney(r.amount), 0)),
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
