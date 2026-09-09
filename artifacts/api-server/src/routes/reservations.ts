import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, reservationsTable, tablesMapTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";
import { readPartySize, normalizeTime } from "../lib/reservationLogic.js";

const router: IRouter = Router();

/** A reservation in one of these states is holding its table. */
const HOLDING = new Set(["seated", "arrived"]);
/** ...and in one of these it is not, so the table goes back to the floor. */
const RELEASING = new Set(["cancelled", "completed", "no_show", "no-show"]);

/**
 * Keep the floor plan in step with the booking sheet.
 *
 * "Seat guest" only ever flipped a status string. The table it named stayed `free` on the
 * floor plan and in the tables API, so a host could seat a party and the next host would
 * hand the same table to someone else. Cancelling or closing a booking never gave the
 * table back either.
 */
async function syncTableForReservation(
  restaurantId: number,
  reservation: typeof reservationsTable.$inferSelect,
) {
  const tableId = reservation.tableId;
  if (!tableId) return;
  const status = String(reservation.status ?? "").toLowerCase();

  if (HOLDING.has(status)) {
    await db.update(tablesMapTable).set({
      status: "occupied",
      currentCustomerName: reservation.customerName,
      currentGuestCount: reservation.guestCount ?? 0,
      occupiedSince: new Date(),
    }).where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)));
    return;
  }

  if (RELEASING.has(status)) {
    const [table] = await db.select().from(tablesMapTable)
      .where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)));
    // A live order outranks the booking sheet: the party may have left the booking open
    // and still be eating, and clearing the table would lose the order on the floor plan.
    if (!table || table.currentOrderId) return;
    await db.update(tablesMapTable).set({
      status: "free",
      currentCustomerName: null,
      currentGuestCount: 0,
      occupiedSince: null,
    }).where(and(eq(tablesMapTable.id, tableId), eq(tablesMapTable.restaurantId, restaurantId)));
  }
}

router.get("/restaurants/:restaurantId/reservations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  if (!(await getAccessibleRestaurant(req, id))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { status, date } = req.query;
  let reservations = await db.select().from(reservationsTable).where(eq(reservationsTable.restaurantId, id));
  if (status) reservations = reservations.filter(r => r.status === status);
  if (date) reservations = reservations.filter(r => r.date === date);
  res.json(reservations);
});

router.post("/restaurants/:restaurantId/reservations", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { customerName, customerPhone, customerEmail, date, time, guestCount, status, reservationType, zone, roomNumber, notes, specialRequest, depositAmount, depositStatus, tableId } = req.body;
  if (!customerName || !date || !time) { res.status(400).json({ error: "customerName, date and time required" }); return; }
  // The guest page and the queue endpoint both send `partySize`; only `guestCount` was
  // read, so a party of eight was recorded as a party of two. Both spellings work now.
  const partySize = readPartySize(req.body);
  if (partySize !== null && (partySize < 1 || partySize > 500)) {
    res.status(400).json({ error: "Party size must be between 1 and 500.", field: "partySize" });
    return;
  }
  const depositNum = Number(depositAmount);
  const hasDeposit = Number.isFinite(depositNum) && depositNum > 0;
  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone: customerPhone ?? null,
    customerEmail: customerEmail ?? null,
    date,
    time: normalizeTime(time) ?? time,
    guestCount: partySize ?? guestCount ?? 2,
    status: status ?? "pending",
    // A booking taken over the phone is usually put against a table there and then. The
    // create route dropped `tableId` silently, so it could only ever be added afterwards
    // by editing the booking a second time.
    tableId: tableId ?? null,
    reservationType: reservationType ?? "table",
    zone: zone ?? null,
    roomNumber: roomNumber ?? null,
    notes: notes ?? null,
    specialRequest: specialRequest ?? null,
    depositAmount: hasDeposit ? depositNum.toFixed(2) : "0",
    depositStatus: depositStatus ?? (hasDeposit ? "pending" : "none"),
    bookingToken: `#ADM${Date.now().toString().slice(-6)}`,
  }).returning();
  await syncTableForReservation(restaurantId, reservation);
  res.status(201).json(reservation);
});

router.put("/restaurants/:restaurantId/reservations/:reservationId", requireAuth, async (req, res): Promise<void> => {
  const reservationId = parseInt(String(req.params.reservationId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  // Every field the booking form offers has to be accepted here. The guest's name, phone,
  // email, request, zone and type were all missing, so editing any of them returned 200
  // with the row unchanged — the edit looked saved and was not.
  const {
    status, tableId, roomNumber, date, time, guestCount, notes, depositAmount, depositStatus,
    customerName, customerPhone, customerEmail, specialRequest, zone, reservationType,
  } = req.body;
  const [reservation] = await db.update(reservationsTable).set({
    ...(status !== undefined && { status }),
    ...(tableId !== undefined && { tableId }),
    ...(roomNumber !== undefined && { roomNumber }),
    ...(date !== undefined && { date }),
    ...(time !== undefined && { time }),
    ...(guestCount !== undefined && { guestCount }),
    ...(notes !== undefined && { notes }),
    ...(customerName !== undefined && { customerName }),
    ...(customerPhone !== undefined && { customerPhone }),
    ...(customerEmail !== undefined && { customerEmail }),
    ...(specialRequest !== undefined && { specialRequest }),
    ...(zone !== undefined && { zone }),
    ...(reservationType !== undefined && { reservationType }),
    ...(depositAmount !== undefined && { depositAmount: (Number(depositAmount) || 0).toFixed(2) }),
    ...(depositStatus !== undefined && { depositStatus }),
  }).where(and(eq(reservationsTable.id, reservationId), eq(reservationsTable.restaurantId, restaurantId))).returning();
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }
  await syncTableForReservation(restaurantId, reservation);
  res.json(reservation);
});

router.delete("/restaurants/:restaurantId/reservations/:reservationId", requireAuth, async (req, res): Promise<void> => {
  const reservationId = parseInt(String(req.params.reservationId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const [deleted] = await db.delete(reservationsTable).where(
    and(eq(reservationsTable.id, reservationId), eq(reservationsTable.restaurantId, restaurantId)),
  ).returning();
  if (!deleted) { res.status(404).json({ error: "Reservation not found" }); return; }
  await syncTableForReservation(restaurantId, { ...deleted, status: "cancelled" });
  res.json({ success: true });
});

export default router;
