import { Router, type IRouter, type Request } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  reservationsTable,
  restaurantsTable,
  spaBookingsTable,
  spaServicesTable,
  guestUsersTable,
} from "@workspace/db";
import {
  computeSlotAvailability,
  depositForType,
  generateBookingToken,
  normalizeTime,
  readPartySize,
  validateReservation,
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
  const deposits = await getSettingsSection<Record<string, unknown>>(restaurantId, "reservationDeposits", {});
  res.json({
    date,
    reservationType,
    slots,
    live: true,
    availableCount: slots.filter(s => s.available).length,
    deposit: depositForType(reservationType, deposits),
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
  const deposits = await getSettingsSection<Record<string, unknown>>(restaurantId, "reservationDeposits", {});
  res.json({
    slots: slots.filter(s => s.available).map(s => s.label),
    available: slots,
    deposit: depositForType(reservationType, deposits),
  });
});

/**
 * A booking has to be reachable.
 *
 * The guest page sent `customerPhone: "0000000000"` whenever the visitor was not signed
 * in, because the form never asked for a number. The booking was written under that
 * placeholder, "My Bookings" looks bookings up by phone, and so the guest could never
 * find, change or cancel what they had just booked — and the venue had no way to call
 * the table when the time came. Every anonymous booking on the platform shares the same
 * phone number, so they all belong to each other.
 */
function invalidPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return "Enter a phone number we can reach you on — the venue calls this number if anything changes.";
  }
  // "0000000000", "1111111111" and friends: a single repeated digit is a placeholder.
  if (new Set(digits).size === 1) {
    return "That does not look like a real phone number. The venue needs a number it can call.";
  }
  return null;
}

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

  const phoneProblem = invalidPhone(customerPhone);
  if (phoneProblem) { res.status(400).json({ error: phoneProblem, field: "customerPhone" }); return; }

  const type = reservationType ?? "table";
  // The deposit is the venue's to set, not the client's to send: a guest could name their
  // own. Only what the venue has published counts.
  const venueDeposits = await getSettingsSection<Record<string, unknown>>(restaurantId, "reservationDeposits", {});
  const deposit = depositForType(type, venueDeposits);

  // `guestCount ?? 2` is what made every booking a party of two: the guest page sends
  // `partySize`, which nothing read. Both spellings are accepted, and the rest of the
  // booking is checked before anything is written — party size, a date that has not
  // already passed, a time the venue is actually open, and room left in the sitting.
  const partySize = readPartySize(req.body);
  const [venue] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!venue) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const sameDay = await db.select().from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, restaurantId), eq(reservationsTable.date, String(date))),
  );
  const slotOverrides = await getSettingsSection<Record<string, string[]>>(restaurantId, "reservationSlots", {});
  const problem = validateReservation({
    reservationType: type,
    date: String(date),
    time: String(time),
    partySize,
    openTime: venue.openTime,
    closeTime: venue.closeTime,
    existing: sameDay,
    slotOverrides,
  });
  if (problem) { res.status(400).json(problem); return; }

  const normalizedTime = normalizeTime(time) ?? String(time);

  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone,
    customerEmail,
    date,
    time: normalizedTime,
    guestCount: partySize ?? guestCount ?? 2,
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

  res.status(201).json({
    ...updated,
    bookingToken: token,
    restaurantName: venue.name,
    depositRequired: deposit,
    depositStatus: updated?.depositStatus,
  });
});

/**
 * Load a reservation only if the caller made it.
 *
 * These three routes previously took the integer id and acted on it — so anyone could
 * count upward and confirm, edit, or cancel other people's bookings, and mark deposits
 * as paid without paying. The stored `bookingToken` is no help on its own because it is
 * derived from the id (`#REV0007`), so the check is against the contact details the
 * guest supplied when booking, or the signed-in guest account.
 */
async function loadOwnedReservation(req: Request, id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
  if (!reservation) return null;

  const claimedPhone = String(req.body?.phone ?? req.query?.phone ?? "").replace(/\D/g, "");
  const bookedPhone = String(reservation.customerPhone ?? "").replace(/\D/g, "");
  if (claimedPhone && bookedPhone && claimedPhone === bookedPhone) return reservation;

  const guestUserId = req.session.guestUserId;
  if (guestUserId) {
    const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId)).limit(1);
    if (guest) {
      const guestPhone = String(guest.phone ?? "").replace(/\D/g, "");
      if (guestPhone && bookedPhone && guestPhone === bookedPhone) return reservation;
      if (guest.email && reservation.customerEmail && guest.email === reservation.customerEmail) return reservation;
    }
  }

  return null;
}

router.post("/public/reservations/:id/deposit", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const reservation = await loadOwnedReservation(req, id);
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }

  // The deposit used to be marked paid on the spot with a made-up transaction id and no
  // money involved. Until a gateway is connected there is no way to take a deposit
  // online, so the booking is held and the amount is collected at the venue.
  res.status(503).json({
    error: "Online deposit is not available yet. Your booking is held — the deposit is collected at the venue.",
    reservation,
  });
});

router.put("/public/reservations/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const owned = await loadOwnedReservation(req, id);
  if (!owned) { res.status(404).json({ error: "Reservation not found" }); return; }

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
  const id = parseInt(String(req.params.id), 10);
  const reservation = await loadOwnedReservation(req, id);
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }

  const depositStatus = reservation.depositStatus === "paid" ? "refunded" : reservation.depositStatus;
  const [updated] = await db.update(reservationsTable).set({
    status: "cancelled",
    depositStatus,
  }).where(eq(reservationsTable.id, id)).returning();
  res.json(updated);
});

export default router;
