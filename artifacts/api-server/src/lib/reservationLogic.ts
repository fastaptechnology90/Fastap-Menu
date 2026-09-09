import type { Reservation } from "@workspace/db";

export const SLOTS_BY_TYPE: Record<string, string[]> = {
  table: ["12:00", "12:30", "13:00", "13:30", "14:00", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
  vip: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
  hall: ["11:00", "14:00", "18:00", "20:00"],
  banquet: ["11:00", "14:00", "18:00", "20:00"],
  pool: ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"],
  spa: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
  cabana: ["10:00", "12:00", "14:00", "16:00", "18:00"],
  conference: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"],
};

const CAPACITY_BY_TYPE: Record<string, number> = {
  table: 4,
  vip: 2,
  hall: 1,
  banquet: 1,
  pool: 3,
  spa: 2,
  cabana: 2,
  conference: 2,
};

/**
 * What each kind of booking asks for up front.
 *
 * This was a fixed platform-wide price list — table ₹500, banquet ₹10,000 — with no per-venue
 * override anywhere. A guest was told "₹10,000 required for Banquet Reservation" and a real
 * reservation row was written with `depositAmount: 10000, depositStatus: "pending"`, so the
 * venue's own staff saw ₹10,000 owed that the venue had never asked for. And since online
 * payment is off, the deposit could never be paid, so the booking sat `pending` for ever and
 * the guest never learned whether they had a table.
 *
 * A venue that has set no deposits now asks for none, and the booking confirms.
 */
const DEPOSIT_BY_TYPE: Record<string, number> = {};

/**
 * The largest party each kind of booking can take.
 *
 * Nothing validated party size at all, so a booking for 500 people at a table was written
 * to the database and shown to the venue as a real reservation.
 */
const MAX_PARTY_BY_TYPE: Record<string, number> = {
  table: 20,
  vip: 12,
  hall: 200,
  banquet: 500,
  pool: 20,
  spa: 4,
  cabana: 8,
  conference: 100,
};

/** How far ahead a booking can be made. Beyond this it is a data-entry mistake, not a plan. */
const MAX_DAYS_AHEAD = 365;

/**
 * Read the party size off a request.
 *
 * The API read `guestCount` while the guest page — and the queue endpoint next door — send
 * `partySize`, so the number was silently dropped and every booking on the platform was
 * stored as a party of two. A party of eight booked, eight arrived, and a two-top was
 * waiting. Both spellings are now read, so neither caller has to change.
 */
export function readPartySize(body: Record<string, unknown>): number | null {
  for (const key of ["guestCount", "partySize", "guests", "people"]) {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

/** "8:00 PM" and "20:00" are the same slot; the two halves of this product each used one. */
export function normalizeTime(raw: unknown): string | null {
  const text = String(raw ?? "").trim().toUpperCase();
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (match[3] === "PM" && hour < 12) hour += 12;
  if (match[3] === "AM" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Everything that has to be true before a booking is written.
 *
 * None of it was checked: a party of 500, on 1 January 2020, at 03:00, at a venue open
 * 11:00–23:00, was accepted and stored — and the same slot could be sold without limit
 * because the availability the guest was shown was never consulted when the booking came
 * back in.
 */
export function validateReservation(input: {
  reservationType: string;
  date: string;
  time: string;
  partySize: number | null;
  openTime?: string | null;
  closeTime?: string | null;
  existing: Reservation[];
  slotOverrides?: Record<string, string[]>;
  today?: Date;
}): { error: string; field: string } | null {
  const type = input.reservationType || "table";

  const size = input.partySize;
  if (size === null || !Number.isInteger(size) || size < 1) {
    return { error: "How many people is the booking for?", field: "partySize" };
  }
  const maxParty = MAX_PARTY_BY_TYPE[type] ?? 20;
  if (size > maxParty) {
    return {
      error: `A ${type} booking takes up to ${maxParty} guests. For a larger party, please call the venue.`,
      field: "partySize",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { error: "Pick a date for the booking.", field: "date" };
  }
  const now = input.today ?? new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  if (input.date < todayStr) {
    return { error: "That date has already passed. Please pick a date from today onwards.", field: "date" };
  }
  const limit = new Date(now.getTime() + MAX_DAYS_AHEAD * 86400000);
  const limitStr = [
    limit.getFullYear(),
    String(limit.getMonth() + 1).padStart(2, "0"),
    String(limit.getDate()).padStart(2, "0"),
  ].join("-");
  if (input.date > limitStr) {
    return { error: `Bookings can be made up to ${MAX_DAYS_AHEAD} days ahead.`, field: "date" };
  }

  const time = normalizeTime(input.time);
  if (!time) return { error: "Pick a time for the booking.", field: "time" };

  // A venue open 11:00–23:00 was accepting 03:00 bookings.
  const open = normalizeTime(input.openTime ?? "11:00") ?? "11:00";
  const close = normalizeTime(input.closeTime ?? "23:00") ?? "23:00";
  const openMin = minutesOf(open);
  const closeMin = minutesOf(close);
  const timeMin = minutesOf(time);
  const withinHours = closeMin > openMin
    ? timeMin >= openMin && timeMin <= closeMin
    // A venue closing after midnight has a window that wraps.
    : timeMin >= openMin || timeMin <= closeMin;
  if (!withinHours) {
    return {
      error: `The venue takes bookings between ${formatTimeLabel(open)} and ${formatTimeLabel(close)}.`,
      field: "time",
    };
  }

  // The booking has to fit in the sitting. Availability was computed and shown to the
  // guest, then ignored when the booking arrived, so one 8pm slot could be sold a
  // hundred times over.
  const availability = computeSlotAvailability(type, input.date, input.existing, input.slotOverrides);
  const slot = availability.find(s => s.time === time);
  if (slot && !slot.available) {
    const free = availability.filter(s => s.available).map(s => s.label);
    return {
      error: free.length
        ? `${formatTimeLabel(time)} is fully booked. Still free: ${free.slice(0, 4).join(", ")}.`
        : `${formatTimeLabel(time)} is fully booked, and so is the rest of that day.`,
      field: "time",
    };
  }

  return null;
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function depositForType(type: string, venueDeposits?: Record<string, unknown> | null): number {
  const set = venueDeposits?.[type];
  const amount = Number(set);
  if (Number.isFinite(amount) && amount >= 0) return Math.round(amount * 100) / 100;
  return DEPOSIT_BY_TYPE[type] ?? 0;
}

export function generateBookingToken(id: number): string {
  return `#REV${String(id).padStart(4, "0")}`;
}

export function slotsForType(
  reservationType: string,
  overrides?: Record<string, string[]>,
): string[] {
  if (overrides?.[reservationType]?.length) return overrides[reservationType];
  return SLOTS_BY_TYPE[reservationType] ?? SLOTS_BY_TYPE.table;
}

export function computeSlotAvailability(
  reservationType: string,
  date: string,
  existing: Reservation[],
  slotOverrides?: Record<string, string[]>,
): { time: string; label: string; available: boolean; remaining: number }[] {
  const slots = slotsForType(reservationType, slotOverrides);
  const maxPerSlot = CAPACITY_BY_TYPE[reservationType] ?? 4;
  const active = existing.filter(
    r => r.date === date && r.status !== "cancelled" && r.reservationType === reservationType,
  );

  return slots.map(time => {
    const booked = active.filter(r => {
      const rt = r.time.replace(/\s*(AM|PM)/i, "").trim();
      return rt === time || r.time === time || r.time === formatTimeLabel(time);
    }).length;
    const remaining = Math.max(0, maxPerSlot - booked);
    return {
      time,
      label: formatTimeLabel(time),
      available: remaining > 0,
      remaining,
    };
  });
}

export const RESERVATION_TYPE_CATALOG = [
  { id: "table", label: "Table Reservation", icon: "🍽️", deposit: 500, minGuests: 1, maxGuests: 12 },
  { id: "vip", label: "VIP Reservation", icon: "👑", deposit: 1000, minGuests: 2, maxGuests: 8 },
  { id: "hall", label: "Hall Reservation", icon: "🏛️", deposit: 5000, minGuests: 20, maxGuests: 80 },
  { id: "banquet", label: "Banquet Reservation", icon: "🎊", deposit: 10000, minGuests: 50, maxGuests: 300 },
  { id: "pool", label: "Pool Booking", icon: "🏊", deposit: 300, minGuests: 1, maxGuests: 10 },
  { id: "spa", label: "Spa Booking", icon: "💆", deposit: 0, minGuests: 1, maxGuests: 4 },
  { id: "cabana", label: "Cabana Booking", icon: "🏖️", deposit: 1500, minGuests: 2, maxGuests: 8 },
  { id: "conference", label: "Conference Booking", icon: "💼", deposit: 2000, minGuests: 4, maxGuests: 40 },
];
