/** Hotel Guest Service System — service catalog */
export const ROOM_SERVICE_REQUESTS = [
  { id: "food", label: "Food Ordering", icon: "🍽️", desc: "Order room service from menu", api: "roomService" as const, type: "food" },
  { id: "laundry", label: "Laundry Request", icon: "👔", desc: "Pickup & press service", api: "roomService" as const, type: "laundry" },
  { id: "housekeeping", label: "Housekeeping", icon: "✨", desc: "Room cleaning & turndown", api: "housekeeping" as const, type: "cleaning" },
  { id: "maintenance", label: "Maintenance", icon: "🔧", desc: "Report room issues", api: "maintenance" as const, type: "general" },
  { id: "towel", label: "Towel Request", icon: "🛁", desc: "Fresh towels & bath linen", api: "roomService" as const, type: "towel" },
  { id: "toiletries", label: "Toiletries Request", icon: "🧴", desc: "Shampoo, soap, dental kit", api: "roomService" as const, type: "toiletries" },
  { id: "extra_bed", label: "Extra Bed Request", icon: "🛏️", desc: "Rollaway or extra mattress", api: "roomService" as const, type: "extra_bed" },
  { id: "baby_crib", label: "Baby Crib Request", icon: "👶", desc: "Crib with bedding", api: "roomService" as const, type: "baby_crib" },
  { id: "wake_up", label: "Wake-up Call", icon: "⏰", desc: "Scheduled morning call", api: "wakeUp" as const, type: "wake_up" },
] as const;

export type RoomControls = {
  ac: { on: boolean; temp: number; mode: "cool" | "heat" | "fan" };
  lights: { on: boolean; brightness: number };
  curtains: { open: number };
  tv: { on: boolean; channel: number; volume: number };
  dnd: boolean;
  cleaningStatus: "clean" | "in_progress" | "scheduled" | "dirty";
};

export const DEFAULT_ROOM_CONTROLS: RoomControls = {
  ac: { on: true, temp: 22, mode: "cool" },
  lights: { on: true, brightness: 70 },
  curtains: { open: 60 },
  tv: { on: false, channel: 1, volume: 35 },
  dnd: false,
  cleaningStatus: "clean",
};

export const CLEANING_STATUS_LABELS: Record<RoomControls["cleaningStatus"], string> = {
  clean: "Room is clean & ready",
  in_progress: "Housekeeping in progress",
  scheduled: "Cleaning scheduled",
  dirty: "Awaiting housekeeping",
};

export const TV_CHANNELS = [
  { id: 1, name: "News 24" },
  { id: 2, name: "Sports HD" },
  { id: 3, name: "Movies Plus" },
  { id: 4, name: "Music Lounge" },
  { id: 5, name: "Hotel Info" },
];
