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

function phoneDigits(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Same person whether they typed 98765…, +91 98765…, or 9198765…. */
function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shortA = a.length > 10 ? a.slice(-10) : a;
  const shortB = b.length > 10 ? b.slice(-10) : b;
  return shortA.length >= 8 && shortA === shortB;
}

/**
 * "My Bookings".
 *
 * `restaurantId` used to be mandatory, which made this the guest's bookings *at the venue
 * whose QR they are currently standing in front of* rather than their bookings. A guest
 * who opened Bookings from the profile — no scan, no venue in context — got a 400 and an
 * empty list, and a booking made at one venue was invisible from any other.
 *
 * It is now optional, and the venue's name travels with each row so a list spanning two
 * venues can be read. Scoping is unchanged where it is given, so the in-venue call
 * behaves exactly as before.
 *
 * Identification is still the phone number on the booking, or the signed-in guest's own
 * number. That is the same test as before; dropping the venue filter does not widen who
 * can be looked up, only how much of one person's own history comes back at once.
 */
router.get("/public/reservations", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);

  // Prefer the phone the guest typed; fall back to the signed-in guest session so
  // "My Bookings" can list without a second search step.
  let phone = String(req.query.phone ?? "").trim();
  if (!phone && req.session.guestUserId) {
    const [guest] = await db.select().from(guestUsersTable)
      .where(eq(guestUsersTable.id, req.session.guestUserId)).limit(1);
    phone = String(guest?.phone ?? "").trim();
  }
  if (!phone) {
    res.status(400).json({ error: "phone required (or sign in as a guest)" });
    return;
  }

  const want = phoneDigits(phone);
  const filterQ = String(req.query.q ?? "").trim().toLowerCase();

  const rows = await db.select().from(reservationsTable)
    .where(restaurantId ? eq(reservationsTable.restaurantId, restaurantId) : undefined)
    .orderBy(desc(reservationsTable.date), desc(reservationsTable.createdAt));

  let list = rows.filter(r => phonesMatch(phoneDigits(r.customerPhone), want));
  if (filterQ) {
    list = list.filter(r => {
      const token = (r.bookingToken ?? generateBookingToken(r.id)).toLowerCase();
      return token.includes(filterQ)
        || String(r.id).includes(filterQ)
        || String(r.date ?? "").includes(filterQ)
        || String(r.customerName ?? "").toLowerCase().includes(filterQ)
        || String(r.time ?? "").toLowerCase().includes(filterQ);
    });
  }

  // One lookup for the handful of venues actually present, rather than a join on every row.
  const venueIds = [...new Set(list.map(r => r.restaurantId))];
  const venues = venueIds.length
    ? await db.select({ id: restaurantsTable.id, name: restaurantsTable.name, slug: restaurantsTable.slug })
        .from(restaurantsTable)
    : [];
  const venueById = new Map(venues.map(v => [v.id, v]));

  res.json(list.map(r => ({
    ...r,
    bookingToken: r.bookingToken ?? generateBookingToken(r.id),
    restaurantName: venueById.get(r.restaurantId)?.name ?? null,
    restaurantSlug: venueById.get(r.restaurantId)?.slug ?? null,
  })));
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
    tableId, payDeposit: _payDepositIgnored, serviceId,
  } = req.body;
  const missing: string[] = [];
  if (!restaurantId) missing.push("restaurant");
  if (!String(customerName ?? "").trim()) missing.push("name");
  if (!String(customerPhone ?? "").trim()) missing.push("mobile number");
  if (!date) missing.push("date");
  if (!time) missing.push("time");
  if (missing.length) {
    res.status(400).json({
      error: `Please fill mandatory fields: ${missing.join(", ")}`,
      fields: missing,
    });
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
    // Client `payDeposit: true` used to mark the deposit paid with no money moving.
    // Online deposit is refused on POST /:id/deposit until a gateway capture exists —
    // create always leaves deposit pending when one is required.
    depositStatus: deposit > 0 ? "pending" : "none",
    tableId: tableId ?? null,
    status: deposit > 0 ? "pending" : "confirmed",
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
      paymentStatus: "pending",
    }).catch(() => {});
  }

  res.status(201).json({
    ...updated,
    bookingToken: token,
    restaurantName: venue.name,
    depositRequired: deposit,
    depositStatus: updated?.depositStatus,
    depositNote: deposit > 0
      ? "Deposit is due at the venue (or via the deposit endpoint once online payments are live). It is not marked paid on booking."
      : undefined,
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

  const claimedPhone = phoneDigits(req.body?.phone ?? req.query?.phone ?? "");
  const bookedPhone = phoneDigits(reservation.customerPhone);
  // Same normalization as GET /public/reservations — +91 vs local 10-digit must both own.
  if (phonesMatch(claimedPhone, bookedPhone)) return reservation;

  const guestUserId = req.session.guestUserId;
  if (guestUserId) {
    const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId)).limit(1);
    if (guest) {
      if (phonesMatch(phoneDigits(guest.phone), bookedPhone)) return reservation;
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
