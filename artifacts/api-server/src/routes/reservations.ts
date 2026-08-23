import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, reservationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/reservations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, id))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { status, date } = req.query;
  let reservations = await db.select().from(reservationsTable).where(eq(reservationsTable.restaurantId, id));
  if (status) reservations = reservations.filter(r => r.status === status);
  if (date) reservations = reservations.filter(r => r.date === date);
  res.json(reservations);
});

router.post("/restaurants/:restaurantId/reservations", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { customerName, customerPhone, customerEmail, date, time, guestCount, status, reservationType, zone, roomNumber, notes, specialRequest, depositAmount, depositStatus } = req.body;
  if (!customerName || !date || !time) { res.status(400).json({ error: "customerName, date and time required" }); return; }
  const depositNum = Number(depositAmount);
  const hasDeposit = Number.isFinite(depositNum) && depositNum > 0;
  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone: customerPhone ?? null,
    customerEmail: customerEmail ?? null,
    date,
    time,
    guestCount: guestCount ?? 2,
    status: status ?? "pending",
    reservationType: reservationType ?? "table",
    zone: zone ?? null,
    roomNumber: roomNumber ?? null,
    notes: notes ?? null,
    specialRequest: specialRequest ?? null,
    depositAmount: hasDeposit ? depositNum.toFixed(2) : "0",
    depositStatus: depositStatus ?? (hasDeposit ? "pending" : "none"),
    bookingToken: `#ADM${Date.now().toString().slice(-6)}`,
  }).returning();
  res.status(201).json(reservation);
});

router.put("/restaurants/:restaurantId/reservations/:reservationId", requireAuth, async (req, res): Promise<void> => {
  const reservationId = parseInt(req.params.reservationId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { status, tableId, roomNumber, date, time, guestCount, notes, depositAmount, depositStatus } = req.body;
  const [reservation] = await db.update(reservationsTable).set({
    ...(status !== undefined && { status }),
    ...(tableId !== undefined && { tableId }),
    ...(roomNumber !== undefined && { roomNumber }),
    ...(date !== undefined && { date }),
    ...(time !== undefined && { time }),
    ...(guestCount !== undefined && { guestCount }),
    ...(notes !== undefined && { notes }),
    ...(depositAmount !== undefined && { depositAmount: (Number(depositAmount) || 0).toFixed(2) }),
    ...(depositStatus !== undefined && { depositStatus }),
  }).where(and(eq(reservationsTable.id, reservationId), eq(reservationsTable.restaurantId, restaurantId))).returning();
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }
  res.json(reservation);
});

router.delete("/restaurants/:restaurantId/reservations/:reservationId", requireAuth, async (req, res): Promise<void> => {
  const reservationId = parseInt(req.params.reservationId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const [deleted] = await db.delete(reservationsTable).where(
    and(eq(reservationsTable.id, reservationId), eq(reservationsTable.restaurantId, restaurantId)),
  ).returning();
  if (!deleted) { res.status(404).json({ error: "Reservation not found" }); return; }
  res.json({ success: true });
});

export default router;
