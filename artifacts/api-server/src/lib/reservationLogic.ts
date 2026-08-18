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

const DEPOSIT_BY_TYPE: Record<string, number> = {
  table: 500,
  vip: 1000,
  hall: 5000,
  banquet: 10000,
  pool: 300,
  spa: 0,
  cabana: 1500,
  conference: 2000,
};

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function depositForType(type: string): number {
  return DEPOSIT_BY_TYPE[type] ?? 500;
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
