export const TABLE_STATUSES = [
  { id: "free", label: "Free", color: "emerald", available: true },
  { id: "occupied", label: "Occupied", color: "orange", available: false },
  { id: "reserved", label: "Reserved", color: "blue", available: false },
  { id: "cleaning", label: "Cleaning", color: "yellow", available: false },
  { id: "billing", label: "Billing Running", color: "violet", available: false },
  { id: "waiting_food", label: "Waiting for Food", color: "amber", available: false },
  { id: "maintenance", label: "Maintenance", color: "gray", available: false },
  { id: "vip_occupied", label: "VIP Occupied", color: "purple", available: false },
  { id: "blocked", label: "Blocked", color: "red", available: false },
  { id: "under_service", label: "Under Service", color: "cyan", available: false },
] as const;

export type TableStatusId = (typeof TABLE_STATUSES)[number]["id"];

export const TABLE_TYPE_CATALOG = {
  restaurant: {
    label: "Restaurant Tables",
    types: [
      { id: "2_seater", label: "2 Seater Table", defaultCapacity: 2 },
      { id: "4_seater", label: "4 Seater Table", defaultCapacity: 4 },
      { id: "6_seater", label: "6 Seater Table", defaultCapacity: 6 },
      { id: "family", label: "Family Table", defaultCapacity: 8 },
      { id: "vip", label: "VIP Table", defaultCapacity: 4 },
      { id: "couple", label: "Couple Table", defaultCapacity: 2 },
      { id: "high_chair", label: "High Chair Table", defaultCapacity: 4 },
      { id: "bar", label: "Bar Table", defaultCapacity: 2 },
      { id: "window_side", label: "Window Side Table", defaultCapacity: 4 },
      { id: "corner", label: "Corner Table", defaultCapacity: 4 },
    ],
  },
  outdoor: {
    label: "Outdoor Tables",
    types: [
      { id: "garden", label: "Garden Table", defaultCapacity: 4 },
      { id: "rooftop", label: "Rooftop Table", defaultCapacity: 4 },
      { id: "poolside", label: "Poolside Table", defaultCapacity: 4 },
      { id: "beachside", label: "Beachside Table", defaultCapacity: 4 },
      { id: "cabana", label: "Cabana Table", defaultCapacity: 6 },
      { id: "open_terrace", label: "Open Terrace Table", defaultCapacity: 4 },
    ],
  },
  hotel_resort: {
    label: "Hotel & Resort Tables",
    types: [
      { id: "room_dining", label: "Room Dining Table", defaultCapacity: 2 },
      { id: "lounge", label: "Lounge Table", defaultCapacity: 4 },
      { id: "cafe", label: "Café Table", defaultCapacity: 2 },
      { id: "banquet", label: "Banquet Table", defaultCapacity: 10 },
      { id: "conference", label: "Conference Table", defaultCapacity: 8 },
    ],
  },
} as const;

export type TableCategoryId = keyof typeof TABLE_TYPE_CATALOG;

const AVAILABLE_STATUSES = new Set(TABLE_STATUSES.filter(s => s.available).map(s => s.id));

export function isTableAvailable(status: string): boolean {
  return AVAILABLE_STATUSES.has(status as TableStatusId);
}

export function suggestTables(
  tables: {
    id: number;
    name: string;
    zone: string | null;
    capacity: number;
    status: string;
    tableType: string;
    tableCategory: string;
    isVip?: boolean;
    currentGuestCount?: number;
  }[],
  partySize: number,
  opts: { preferVip?: boolean; category?: string; zone?: string } = {},
) {
  const free = tables.filter(t =>
    isTableAvailable(t.status) &&
    t.capacity >= partySize &&
    (!opts.category || t.tableCategory === opts.category) &&
    (!opts.zone || (t.zone ?? "").toLowerCase().includes(opts.zone.toLowerCase())),
  );

  const scored = free.map(t => {
    let score = 100 - Math.abs(t.capacity - partySize) * 10;
    if (opts.preferVip && t.isVip) score += 20;
    if (t.capacity === partySize) score += 15;
    if (t.tableType === "couple" && partySize === 2) score += 10;
    if (t.tableType === "family" && partySize >= 6) score += 10;
    return { ...t, score, fit: t.capacity >= partySize ? "perfect" : t.capacity - partySize <= 2 ? "good" : "ok" };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function detectSeatCapacity(table: { capacity: number; currentGuestCount?: number }, partySize: number) {
  const remaining = table.capacity - (table.currentGuestCount ?? 0);
  return {
    capacity: table.capacity,
    currentGuests: table.currentGuestCount ?? 0,
    remainingSeats: remaining,
    canAccommodate: remaining >= partySize,
    overCapacity: partySize > table.capacity,
  };
}

export function estimateWaitMinutes(freeCount: number, queueLength: number, partySize: number): number {
  if (freeCount > 0) return 0;
  const base = 8;
  const queueFactor = queueLength * base;
  const sizeFactor = partySize > 4 ? 10 : partySize > 6 ? 15 : 0;
  return Math.min(90, queueFactor + sizeFactor + 5);
}

export function estimateQueuePosition(queueLength: number): number {
  return queueLength + 1;
}

export function generateSeatingToken(): string {
  return `seat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function tableTypeLabel(category: string, type: string): string {
  const cat = TABLE_TYPE_CATALOG[category as TableCategoryId];
  if (!cat) return type.replace(/_/g, " ");
  return cat.types.find(t => t.id === type)?.label ?? type.replace(/_/g, " ");
}

export function statusLabel(status: string): string {
  return TABLE_STATUSES.find(s => s.id === status)?.label ?? status.replace(/_/g, " ");
}
