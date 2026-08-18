/** Reservation System — types, seating, deposits */
export const RESERVATION_TYPES = [
  { id: "table", label: "Table Reservation", icon: "🍽️", desc: "Dine-in table booking", minGuests: 1, maxGuests: 12, deposit: 500 },
  { id: "vip", label: "VIP Reservation", icon: "👑", desc: "Premium VIP lounge seating", minGuests: 2, maxGuests: 8, deposit: 1000 },
  { id: "hall", label: "Hall Reservation", icon: "🏛️", desc: "Private hall for gatherings", minGuests: 20, maxGuests: 80, deposit: 5000 },
  { id: "banquet", label: "Banquet Reservation", icon: "🎊", desc: "Full banquet & catering", minGuests: 50, maxGuests: 300, deposit: 10000 },
  { id: "pool", label: "Pool Booking", icon: "🏊", desc: "Pool deck & loungers", minGuests: 1, maxGuests: 10, deposit: 300 },
  { id: "spa", label: "Spa Booking", icon: "💆", desc: "Spa treatments & wellness", minGuests: 1, maxGuests: 4, deposit: 0 },
  { id: "cabana", label: "Cabana Booking", icon: "🏖️", desc: "Private poolside cabana", minGuests: 2, maxGuests: 8, deposit: 1500 },
  { id: "conference", label: "Conference Booking", icon: "💼", desc: "Meeting rooms & AV setup", minGuests: 4, maxGuests: 40, deposit: 2000 },
] as const;

export type ReservationTypeId = (typeof RESERVATION_TYPES)[number]["id"];

export const SEATING_PREFERENCES = [
  { id: "indoor-ac", label: "Indoor AC", icon: "❄️", types: ["table", "vip", "banquet"] },
  { id: "outdoor", label: "Outdoor", icon: "🌿", types: ["table", "pool", "cabana"] },
  { id: "rooftop", label: "Rooftop", icon: "🌃", types: ["table", "vip"] },
  { id: "private", label: "Private Cabin", icon: "🔒", types: ["table", "vip", "hall"] },
  { id: "poolside", label: "Poolside", icon: "🏊", types: ["table", "pool", "cabana"] },
  { id: "vip-lounge", label: "VIP Lounge", icon: "👑", types: ["vip", "banquet"] },
  { id: "conference-room", label: "Conference Room", icon: "💼", types: ["conference", "hall"] },
  { id: "banquet-hall", label: "Banquet Hall", icon: "🏛️", types: ["banquet", "hall"] },
] as const;

export const SPECIAL_OCCASIONS = [
  "🎂 Birthday", "💑 Anniversary", "🎊 Celebration", "💼 Business",
  "🌹 Date Night", "👨‍👩‍👧 Family", "🎓 Graduation", "🤝 Meeting",
];

export function depositForType(typeId: string): number {
  return RESERVATION_TYPES.find(t => t.id === typeId)?.deposit ?? 500;
}

export function guestLimits(typeId: string) {
  const t = RESERVATION_TYPES.find(x => x.id === typeId);
  return { min: t?.minGuests ?? 1, max: t?.maxGuests ?? 20 };
}

export function seatingForType(typeId: string) {
  return SEATING_PREFERENCES.filter(s => s.types.includes(typeId as never));
}

export interface SlotInfo {
  time: string;
  label: string;
  available: boolean;
  remaining: number;
}

export interface ReservationRecord {
  id: number;
  restaurantId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  date: string;
  time: string;
  guestCount: number;
  reservationType: string;
  zone?: string | null;
  specialRequest?: string | null;
  notes?: string | null;
  depositAmount?: string | null;
  depositStatus?: string | null;
  bookingToken?: string | null;
  status: string;
}
