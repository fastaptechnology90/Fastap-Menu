export const TABLE_STATUSES = [
  { id: "free", label: "Free", color: "emerald" },
  { id: "occupied", label: "Occupied", color: "orange" },
  { id: "reserved", label: "Reserved", color: "blue" },
  { id: "cleaning", label: "Cleaning", color: "yellow" },
  { id: "billing", label: "Billing Running", color: "violet" },
  { id: "waiting_food", label: "Waiting for Food", color: "amber" },
  { id: "maintenance", label: "Maintenance", color: "gray" },
  { id: "vip_occupied", label: "VIP Occupied", color: "purple" },
  { id: "blocked", label: "Blocked", color: "red" },
  { id: "under_service", label: "Under Service", color: "cyan" },
] as const;

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

export const DEMO_TABLES = [
  { id: 1, name: "T-2A", zone: "AC Section", capacity: 2, status: "free", tableType: "2_seater", tableCategory: "restaurant", isVip: false, currentGuestCount: 0, available: true },
  { id: 2, name: "T-4A", zone: "AC Section", capacity: 4, status: "occupied", tableType: "4_seater", tableCategory: "restaurant", isVip: false, currentGuestCount: 3, available: false },
  { id: 3, name: "T-6A", zone: "Premium Indoor", capacity: 6, status: "free", tableType: "6_seater", tableCategory: "restaurant", isVip: false, currentGuestCount: 0, available: true },
  { id: 4, name: "T-FAM", zone: "Family Section", capacity: 8, status: "occupied", tableType: "family", tableCategory: "restaurant", isVip: false, currentGuestCount: 6, available: false },
  { id: 5, name: "T-VIP", zone: "VIP Lounge", capacity: 4, status: "vip_occupied", tableType: "vip", tableCategory: "restaurant", isVip: true, currentGuestCount: 4, available: false },
  { id: 6, name: "T-CPL", zone: "Fine Dine Section", capacity: 2, status: "reserved", tableType: "couple", tableCategory: "restaurant", isVip: false, currentGuestCount: 0, available: false },
  { id: 7, name: "T-HC", zone: "Kids Friendly Zone", capacity: 4, status: "free", tableType: "high_chair", tableCategory: "restaurant", isVip: false, currentGuestCount: 0, available: true },
  { id: 8, name: "T-BAR1", zone: "Sunset Lounge", capacity: 2, status: "occupied", tableType: "bar", tableCategory: "restaurant", isVip: false, currentGuestCount: 2, available: false },
  { id: 9, name: "T-WIN", zone: "Premium Indoor", capacity: 4, status: "waiting_food", tableType: "window_side", tableCategory: "restaurant", isVip: false, currentGuestCount: 2, available: false },
  { id: 10, name: "T-CRN", zone: "Silent Dining Zone", capacity: 4, status: "free", tableType: "corner", tableCategory: "restaurant", isVip: false, currentGuestCount: 0, available: true },
  { id: 11, name: "T-12", zone: "Garden Seating", capacity: 4, status: "free", tableType: "garden", tableCategory: "outdoor", isVip: false, currentGuestCount: 0, available: true },
  { id: 12, name: "R-1", zone: "Rooftop Seating", capacity: 4, status: "occupied", tableType: "rooftop", tableCategory: "outdoor", isVip: false, currentGuestCount: 3, available: false },
  { id: 13, name: "P-1", zone: "Poolside Seating", capacity: 4, status: "free", tableType: "poolside", tableCategory: "outdoor", isVip: false, currentGuestCount: 0, available: true },
  { id: 14, name: "B-1", zone: "Beachside Seating", capacity: 4, status: "cleaning", tableType: "beachside", tableCategory: "outdoor", isVip: false, currentGuestCount: 0, available: false },
  { id: 15, name: "CAB-1", zone: "Poolside Seating", capacity: 6, status: "reserved", tableType: "cabana", tableCategory: "outdoor", isVip: false, currentGuestCount: 0, available: false },
  { id: 16, name: "TR-1", zone: "Open Terrace Seating", capacity: 4, status: "free", tableType: "open_terrace", tableCategory: "outdoor", isVip: false, currentGuestCount: 0, available: true },
  { id: 17, name: "R-501", zone: "Balcony Seating", capacity: 2, status: "free", tableType: "room_dining", tableCategory: "hotel_resort", isVip: false, currentGuestCount: 0, available: true },
  { id: 18, name: "L-1", zone: "Sunset Lounge", capacity: 4, status: "under_service", tableType: "lounge", tableCategory: "hotel_resort", isVip: false, currentGuestCount: 0, available: false },
  { id: 19, name: "CF-1", zone: "Fast Dining Section", capacity: 2, status: "free", tableType: "cafe", tableCategory: "hotel_resort", isVip: false, currentGuestCount: 0, available: true },
  { id: 20, name: "BNQ-1", zone: "Banquet Section", capacity: 10, status: "blocked", tableType: "banquet", tableCategory: "hotel_resort", isVip: false, currentGuestCount: 0, available: false },
  { id: 21, name: "CONF-1", zone: "Conference Dining Area", capacity: 8, status: "maintenance", tableType: "conference", tableCategory: "hotel_resort", isVip: false, currentGuestCount: 0, available: false },
  { id: 22, name: "T-BIL", zone: "Premium Indoor", capacity: 4, status: "billing", tableType: "4_seater", tableCategory: "restaurant", isVip: false, currentGuestCount: 2, available: false },
];

export function getDemoAvailability(partySize = 2) {
  const byStatus = Object.fromEntries(TABLE_STATUSES.map(s => [s.id, DEMO_TABLES.filter(t => t.status === s.id).length]));
  const free = DEMO_TABLES.filter(t => t.available);
  const suggestions = free
    .filter(t => t.capacity >= partySize)
    .sort((a, b) => Math.abs(a.capacity - partySize) - Math.abs(b.capacity - partySize))
    .slice(0, 5)
    .map(t => ({ ...t, score: 100 - Math.abs(t.capacity - partySize) * 10, fit: t.capacity === partySize ? "perfect" : "good" }));

  return {
    restaurant: { id: 1, name: "Spice Garden", slug: "spice-garden" },
    live: false,
    total: DEMO_TABLES.length,
    freeCount: free.length,
    occupiedCount: DEMO_TABLES.length - free.length,
    byStatus,
    byCategory: {
      restaurant: DEMO_TABLES.filter(t => t.tableCategory === "restaurant").length,
      outdoor: DEMO_TABLES.filter(t => t.tableCategory === "outdoor").length,
      hotel_resort: DEMO_TABLES.filter(t => t.tableCategory === "hotel_resort").length,
    },
    tables: DEMO_TABLES,
    typeCatalog: TABLE_TYPE_CATALOG,
    statuses: TABLE_STATUSES,
    suggestions,
    waitEstimate: {
      estimatedWaitMinutes: free.length > 0 ? 0 : 25,
      queueLength: 4,
      estimatedQueuePosition: 5,
    },
  };
}

export function statusColor(status: string): string {
  return TABLE_STATUSES.find(s => s.id === status)?.color ?? "gray";
}

export function typeLabel(category: string, type: string): string {
  const cat = TABLE_TYPE_CATALOG[category as keyof typeof TABLE_TYPE_CATALOG];
  return cat?.types.find(t => t.id === type)?.label ?? type.replace(/_/g, " ");
}
