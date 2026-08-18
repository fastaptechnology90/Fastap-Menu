import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, hotelRoomsTable, housekeepingTasksTable, roomServiceRequestsTable } from "@workspace/db";
import { getSettingsSection } from "../lib/restaurant-settings.js";
import { autoAssignHousekeepingTask } from "../lib/staff-auto-assignment.js";

const router: IRouter = Router();

const DEFAULT_SERVICES = [
  { id: "food", label: "Food Ordering", icon: "🍽️", desc: "Order room service from menu", api: "roomService", type: "food" },
  { id: "laundry", label: "Laundry Request", icon: "👔", desc: "Pickup & press service", api: "roomService", type: "laundry" },
  { id: "housekeeping", label: "Housekeeping", icon: "✨", desc: "Room cleaning & turndown", api: "housekeeping", type: "cleaning" },
  { id: "maintenance", label: "Maintenance", icon: "🔧", desc: "Report room issues", api: "maintenance", type: "general" },
  { id: "towel", label: "Towel Request", icon: "🛁", desc: "Fresh towels & bath linen", api: "roomService", type: "towel" },
  { id: "toiletries", label: "Toiletries Request", icon: "🧴", desc: "Shampoo, soap, dental kit", api: "roomService", type: "toiletries" },
  { id: "extra_bed", label: "Extra Bed Request", icon: "🛏️", desc: "Rollaway or extra mattress", api: "roomService", type: "extra_bed" },
  { id: "baby_crib", label: "Baby Crib Request", icon: "👶", desc: "Crib with bedding", api: "roomService", type: "baby_crib" },
  { id: "wake_up", label: "Wake-up Call", icon: "⏰", desc: "Scheduled morning call", api: "wakeUp", type: "wake_up" },
];

const DEFAULT_TV_CHANNELS = [
  { id: 1, name: "News 24" },
  { id: 2, name: "Sports HD" },
  { id: 3, name: "Movies Plus" },
  { id: 4, name: "Music Lounge" },
  { id: 5, name: "Hotel Info" },
];

const DEFAULT_CONTROLS = {
  ac: { on: true, temp: 22, mode: "cool" },
  lights: { on: true, brightness: 70 },
  curtains: { open: 60 },
  tv: { on: false, channel: 1, volume: 35 },
  dnd: false,
  cleaningStatus: "clean",
};

function parseControls(raw: unknown) {
  if (typeof raw === "object" && raw !== null) {
    return { ...DEFAULT_CONTROLS, ...(raw as Record<string, unknown>) };
  }
  return { ...DEFAULT_CONTROLS };
}

router.get("/public/hotel/catalog/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(restaurantId, "hotelGuestCatalog", {
    services: DEFAULT_SERVICES,
    tvChannels: DEFAULT_TV_CHANNELS,
  });
  res.json({
    services: Array.isArray(stored.services) && stored.services.length ? stored.services : DEFAULT_SERVICES,
    tvChannels: Array.isArray(stored.tvChannels) && stored.tvChannels.length ? stored.tvChannels : DEFAULT_TV_CHANNELS,
    live: true,
  });
});

router.get("/public/hotel/room/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const roomNumber = req.params.roomNumber;
  let [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)),
  );
  if (!room) {
    [room] = await db.insert(hotelRoomsTable).values({
      restaurantId,
      number: roomNumber,
      type: "deluxe",
      floor: parseInt(roomNumber.replace(/\D/g, "")[0] || "5", 10) || 5,
      status: "occupied",
      roomControls: DEFAULT_CONTROLS,
    }).returning();
  }
  res.json({
    ...room,
    roomControls: parseControls(room.roomControls),
  });
});

router.patch("/public/hotel/room/:restaurantId/:roomNumber/controls", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const roomNumber = req.params.roomNumber;
  const patch = req.body?.roomControls ?? req.body;
  let [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)),
  );
  if (!room) {
    [room] = await db.insert(hotelRoomsTable).values({
      restaurantId,
      number: roomNumber,
      type: "deluxe",
      floor: 5,
      status: "occupied",
      roomControls: { ...DEFAULT_CONTROLS, ...patch },
    }).returning();
  } else {
    const merged = { ...parseControls(room.roomControls), ...patch };
    if (patch.ac) merged.ac = { ...parseControls(room.roomControls).ac, ...patch.ac };
    if (patch.lights) merged.lights = { ...parseControls(room.roomControls).lights, ...patch.lights };
    if (patch.curtain !== undefined) merged.curtains = { open: patch.curtain };
    if (patch.curtains) merged.curtains = { ...parseControls(room.roomControls).curtains, ...patch.curtains };
    if (patch.tv) merged.tv = { ...parseControls(room.roomControls).tv, ...patch.tv };
    if (typeof patch.dnd === "boolean") merged.dnd = patch.dnd;
    if (patch.cleaningStatus) merged.cleaningStatus = patch.cleaningStatus;
    [room] = await db.update(hotelRoomsTable).set({ roomControls: merged }).where(eq(hotelRoomsTable.id, room.id)).returning();
  }
  res.json({ roomControls: parseControls(room.roomControls) });
});

router.post("/public/hotel/wake-up-call", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, guestName, scheduledAt, notes } = req.body;
  if (!restaurantId || !roomNumber || !scheduledAt) {
    res.status(400).json({ error: "restaurantId, roomNumber, and scheduledAt required" });
    return;
  }
  const [task] = await db.insert(housekeepingTasksTable).values({
    restaurantId,
    type: "wake_up",
    title: `Wake-up call — Room ${roomNumber}`,
    description: notes ?? `Wake-up call for ${guestName ?? "guest"}`,
    location: `Room ${roomNumber}`,
    roomNumber,
    priority: "high",
    status: "pending",
    scheduledAt: new Date(scheduledAt),
  }).returning();
  const assigned = await autoAssignHousekeepingTask(restaurantId, task.id);
  res.status(201).json(assigned ?? task);
});

router.get("/public/hotel/requests/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const roomNumber = req.params.roomNumber;
  const requests = await db.select().from(roomServiceRequestsTable).where(
    and(eq(roomServiceRequestsTable.restaurantId, restaurantId), eq(roomServiceRequestsTable.roomNumber, roomNumber)),
  );
  res.json(requests.slice(0, 20));
});

export default router;
