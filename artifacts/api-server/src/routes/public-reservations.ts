import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  reservationsTable,
  restaurantsTable,
  spaBookingsTable,
  spaServicesTable,
} from "@workspace/db";
import {
  computeSlotAvailability,
  depositForType,
  generateBookingToken,
  RESERVATION_TYPE_CATALOG,
} from "../lib/reservationLogic.js";
import { getSettingsSection } from "../lib/restaurant-settings.js";

const router: IRouter = Router();

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isNaN(n) ? 0 : n;
}

router.get("/public/reservations/types", (_req, res) => {
  res.json({ types: RESERVATION_TYPE_CATALOG });
});

router.get("/public/reservations/slots", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  const date = String(req.query.date || "");
  const reservationType = String(req.query.reservationType || "table");
  if (!restaurantId || !date) {
    res.status(400).json({ error: "restaurantId and date required" });
    return;
  }
  const existing = await db.select().from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, restaurantId), eq(reservationsTable.date, date)),
  );
  const reservationSlots = await getSettingsSection<Record<string, string[]>>(restaurantId, "reservationSlots", {});
  const slots = computeSlotAvailability(reservationType, date, existing, reservationSlots);
  res.json({
    date,
    reservationType,
    slots,
    live: true,
    availableCount: slots.filter(s => s.available).length,
    deposit: depositForType(reservationType),
  });
});

router.get("/public/reservations", async (req, res): Promise<void> => {
  const phone = req.query.phone as string;
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  if (!phone || !restaurantId) { res.status(400).json({ error: "phone and restaurantId required" }); return; }
  const list = await db.select().from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, restaurantId), eq(reservationsTable.customerPhone, phone)),
  ).orderBy(desc(reservationsTable.createdAt));
  res.json(list.map(r => ({ ...r, bookingToken: r.bookingToken ?? generateBookingToken(r.id) })));
});

router.get("/public/reservation-slots", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "1"), 10);
  const date = String(req.query.date || new Date().toISOString().split("T")[0]);
  const reservationType = String(req.query.reservationType || "table");
  const existing = await db.select().from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, restaurantId), eq(reservationsTable.date, date)),
  );
  const reservationSlots = await getSettingsSection<Record<string, string[]>>(restaurantId, "reservationSlots", {});
  const slots = computeSlotAvailability(reservationType, date, existing, reservationSlots);
  res.json({
    slots: slots.filter(s => s.available).map(s => s.label),
    available: slots,
    deposit: depositForType(reservationType),
  });
});

router.post("/public/reservations", async (req, res): Promise<void> => {
  const {
    restaurantId, customerName, customerPhone, customerEmail, date, time,
    guestCount, notes, reservationType, zone, specialRequest, depositAmount,
    tableId, payDeposit, serviceId,
  } = req.body;
  if (!restaurantId || !customerName || !customerPhone || !date || !time) {
    res.status(400).json({ error: "Required fields missing" });
    return;
  }

  const type = reservationType ?? "table";
  const deposit = depositAmount != null ? parseNum(depositAmount) : depositForType(type);
  const normalizedTime = time.includes("M") ? time : time;

  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone,
    customerEmail,
    date,
    time: normalizedTime,
    guestCount: guestCount ?? 2,
    notes,
    reservationType: type,
    zone: zone ?? null,
    specialRequest: specialRequest ?? null,
    depositAmount: String(deposit),
    depositStatus: deposit > 0 ? (payDeposit ? "paid" : "pending") : "none",
    tableId: tableId ?? null,
    status: deposit > 0 && !payDeposit ? "pending" : "confirmed",
  }).returning();

  const token = generateBookingToken(reservation.id);
  const [updated] = await db.update(reservationsTable).set({ bookingToken: token }).where(eq(reservationsTable.id, reservation.id)).returning();

  if (type === "spa" && serviceId) {
    const [svc] = await db.select().from(spaServicesTable).where(eq(spaServicesTable.id, serviceId));
    const scheduledAt = new Date(`${date}T${time.length <= 5 ? time : "12:00"}:00`);
    await db.insert(spaBookingsTable).values({
      restaurantId,
      serviceId,
      serviceName: svc?.name ?? "Spa Session",
      guestName: customerName,
      guestPhone: customerPhone,
      guestEmail: customerEmail,
      scheduledAt,
      duration: svc?.duration ?? 60,
      price: svc?.price ?? "0",
      notes: specialRequest ?? notes,
      status: "booked",
      paymentStatus: payDeposit ? "paid" : "pending",
    }).catch(() => {});
  }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));

  res.status(201).json({
    ...updated,
    bookingToken: token,
    restaurantName: restaurant?.name,
    depositRequired: deposit,
    depositStatus: updated?.depositStatus,
  });
});

router.post("/public/reservations/:id/deposit", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { paymentMethod } = req.body;
  const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }

  const [updated] = await db.update(reservationsTable).set({
    depositStatus: "paid",
    status: "confirmed",
  }).where(eq(reservationsTable.id, id)).returning();

  res.json({
    success: true,
    reservation: updated,
    payment: {
      method: paymentMethod ?? "upi",
      amount: parseNum(reservation.depositAmount),
      status: "paid",
      transactionId: `TXN${Date.now()}`,
    },
  });
});

router.put("/public/reservations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { date, time, guestCount, notes, specialRequest, zone, reservationType } = req.body;
  const [reservation] = await db.update(reservationsTable).set({
    date,
    time,
    guestCount,
    notes,
    specialRequest,
    zone,
    reservationType,
    status: "pending",
  }).where(eq(reservationsTable.id, id)).returning();
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }
  res.json({ ...reservation, bookingToken: reservation.bookingToken ?? generateBookingToken(reservation.id) });
});

router.patch("/public/reservations/:id/cancel", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }

  const depositStatus = reservation.depositStatus === "paid" ? "refunded" : reservation.depositStatus;
  const [updated] = await db.update(reservationsTable).set({
    status: "cancelled",
    depositStatus,
  }).where(eq(reservationsTable.id, id)).returning();
  res.json(updated);
});

export default router;
