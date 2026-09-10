import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, hotelRoomsTable, housekeepingTasksTable, roomServiceRequestsTable } from "@workspace/db";
import { getSettingsSection } from "../lib/restaurant-settings.js";
import { autoAssignHousekeepingTask } from "../lib/staff-auto-assignment.js";
import { callerIsInRoom } from "../lib/guest-room-access.js";

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
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const stored = await getSettingsSection(restaurantId, "hotelGuestCatalog", {
    services: DEFAULT_SERVICES,
    tvChannels: DEFAULT_TV_CHANNELS,
  });
  // `live: true` was hardcoded, so a hotel that had configured nothing still told the
  // guest its in-room list was the real one. It now says which of the two it is, and
  // the TV line-up is only offered when the hotel actually published one — a guest
  // should not be shown five invented channel names as though they were in the room.
  const services = Array.isArray(stored.services) && stored.services.length ? stored.services : DEFAULT_SERVICES;
  const publishedChannels = Array.isArray(stored.tvChannels) && stored.tvChannels.length ? stored.tvChannels : null;
  res.json({
    services,
    tvChannels: publishedChannels ?? [],
    live: Boolean(Array.isArray(stored.services) && stored.services.length),
    tvChannelsPublished: Boolean(publishedChannels),
  });
});

router.get("/public/hotel/room/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const roomNumber = req.params.roomNumber;
  // Room status and control state used to be readable by guessing the number. Same
  // binding as the mutate routes: only the browser that scanned this room's QR.
  if (!(await callerIsInRoom(req, restaurantId, roomNumber))) {
    res.status(403).json({ error: "Scan the QR code in your room to see this room." });
    return;
  }
  // A read must not write. This used to create the room when the number was unknown, so
  // any request for /public/hotel/room/5/9999 added a room to the hotel's inventory —
  // and a stranger's room number is the only thing a caller needs to guess.
  const [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)),
  );
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  // The occupant's identity does not belong in an endpoint keyed on nothing but a room
  // number. Guessing "102" used to return who was staying there, from when to when,
  // with their phone number. The room page needs the controls, not the guest list.
  const { guestPhone: _p, guestName: _n, checkIn: _ci, checkOut: _co, notes: _notes, ...safe } = room;
  res.json({
    ...safe,
    roomControls: parseControls(room.roomControls),
  });
});

router.patch("/public/hotel/room/:restaurantId/:roomNumber/controls", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const roomNumber = req.params.roomNumber;

  // Anyone who could type a room number — or POST /public/session/init with that room —
  // used to switch lights, AC and DND. There is no live hardware link behind this write
  // (the guest UI itself says so), so the honest answer is closed, not a fake toggle.
  if (!(await callerIsInRoom(req, restaurantId, roomNumber))) {
    res.status(403).json({ error: "Scan the QR code in your room to use the room controls." });
    return;
  }

  res.status(503).json({
    error: "In-room controls are not connected to hotel hardware yet. Use the panel by the door.",
    demo: true,
  });
});

router.post("/public/hotel/wake-up-call", async (req, res): Promise<void> => {
  const { restaurantId, roomNumber, guestName, scheduledAt, notes } = req.body;
  if (!restaurantId || !roomNumber || !scheduledAt) {
    res.status(400).json({ error: "restaurantId, roomNumber, and scheduledAt required" });
    return;
  }
  const rid = parseInt(String(restaurantId), 10);
  const room = String(roomNumber);
  // Same as controls: a wake-up call for room 102 must not be bookable by guessing 102.
  if (!(await callerIsInRoom(req, rid, room))) {
    res.status(403).json({ error: "Scan the QR code in your room to set a wake-up call." });
    return;
  }
  const [task] = await db.insert(housekeepingTasksTable).values({
    restaurantId: rid,
    type: "wake_up",
    title: `Wake-up call — Room ${room}`,
    description: notes ?? `Wake-up call for ${guestName ?? "guest"}`,
    location: `Room ${room}`,
    roomNumber: room,
    priority: "high",
    status: "pending",
    scheduledAt: new Date(scheduledAt),
  }).returning();
  const assigned = await autoAssignHousekeepingTask(rid, task.id);
  res.status(201).json(assigned ?? task);
});

router.get("/public/hotel/requests/:restaurantId/:roomNumber", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const roomNumber = req.params.roomNumber;

  // What a room has asked for — and the free-text notes that come with it — is the
  // occupant's business. A room number was the only thing needed to read it.
  if (!(await callerIsInRoom(req, restaurantId, roomNumber))) {
    res.status(403).json({ error: "Scan the QR code in your room to see this room's requests." });
    return;
  }

  const requests = await db.select().from(roomServiceRequestsTable).where(
    and(eq(roomServiceRequestsTable.restaurantId, restaurantId), eq(roomServiceRequestsTable.roomNumber, roomNumber)),
  );
  res.json(requests.slice(0, 20).map(({ guestPhone: _p, ...r }) => r));
});

export default router;
