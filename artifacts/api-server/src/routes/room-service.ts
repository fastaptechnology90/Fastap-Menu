import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, roomServiceRequestsTable, hotelRoomsTable, menuItemsTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection } from "../lib/restaurant-settings";
import { autoAssignRoomServiceRequest } from "../lib/staff-auto-assignment.js";

const router: IRouter = Router();

const DEFAULT_MINIBAR = [
  { id: "MB01", name: "Mineral Water (500ml)", price: 60, category: "beverages" },
  { id: "MB02", name: "Cola (350ml)", price: 80, category: "beverages" },
  { id: "MB03", name: "Peanuts (50g)", price: 40, category: "snacks" },
  { id: "MB04", name: "Chips (30g)", price: 35, category: "snacks" },
  { id: "MB05", name: "Toothbrush Kit", price: 80, category: "amenities" },
];

async function loadMinibarCatalog(restaurantId: number) {
  const stored = await getSettingsSection(restaurantId, "minibarCatalog", { items: [] as typeof DEFAULT_MINIBAR });
  if (Array.isArray(stored.items) && stored.items.length > 0) return stored.items;

  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));
  const beverageCatIds = categories
    .filter(c => /beverage|drink|bar|mini/i.test(c.name))
    .map(c => c.id);
  if (beverageCatIds.length > 0) {
    const items = await db.select().from(menuItemsTable).where(
      and(eq(menuItemsTable.restaurantId, restaurantId), eq(menuItemsTable.isAvailable, true)),
    );
    const beverages = items.filter(i => i.categoryId && beverageCatIds.includes(i.categoryId)).slice(0, 12);
    if (beverages.length > 0) {
      return beverages.map(i => ({
        id: `MB-${i.id}`,
        name: i.name,
        price: parseFloat(String(i.price)),
        category: "beverages",
      }));
    }
  }
  return DEFAULT_MINIBAR;
}

router.get("/restaurants/:restaurantId/minibar", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const items = await loadMinibarCatalog(id);
  res.json(items);
});

router.get("/restaurants/:restaurantId/rooms", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const rooms = await db.select().from(hotelRoomsTable).where(eq(hotelRoomsTable.restaurantId, id)).orderBy(hotelRoomsTable.number);
  res.json(rooms);
});

router.post("/restaurants/:restaurantId/rooms", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { number, type, floor, status, guestName, guestPhone, checkIn, checkOut, notes } = req.body;
  const [room] = await db.insert(hotelRoomsTable).values({ restaurantId: id, number, type, floor: parseInt(floor) || 1, status, guestName, guestPhone, notes, checkIn: checkIn ? new Date(checkIn) : undefined, checkOut: checkOut ? new Date(checkOut) : undefined }).returning();
  res.status(201).json(room);
});

router.put("/restaurants/:restaurantId/rooms/:roomId", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, guestName, guestPhone, checkIn, checkOut, notes } = req.body;
  const [room] = await db.update(hotelRoomsTable).set({ status, guestName, guestPhone, notes, checkIn: checkIn ? new Date(checkIn) : undefined, checkOut: checkOut ? new Date(checkOut) : undefined }).where(and(eq(hotelRoomsTable.id, roomId), eq(hotelRoomsTable.restaurantId, restaurantId))).returning();
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(room);
});

router.get("/restaurants/:restaurantId/room-service", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const requests = await db.select().from(roomServiceRequestsTable).where(eq(roomServiceRequestsTable.restaurantId, id)).orderBy(desc(roomServiceRequestsTable.createdAt));
  res.json(requests.map(r => ({ ...r, total: parseFloat(String(r.total)), items: Array.isArray(r.items) ? r.items : [] })));
});

router.post("/restaurants/:restaurantId/room-service", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { roomNumber, guestName, guestPhone, type, items, notes, total, paymentMethod, assignedTo } = req.body;
  const [request] = await db.insert(roomServiceRequestsTable).values({ restaurantId: id, roomNumber, guestName, guestPhone, type, items: items ?? [], notes, total: String(parseFloat(total) || 0), paymentMethod }).returning();
  const result = assignedTo ? request : await autoAssignRoomServiceRequest(id, request.id);
  res.status(201).json(result ?? request);
});

router.put("/restaurants/:restaurantId/room-service/:requestId", requireAuth, async (req, res): Promise<void> => {
  const requestId = parseInt(req.params.requestId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, assignedTo } = req.body;
  const [request] = await db.update(roomServiceRequestsTable).set({ status, assignedTo, completedAt: status === "completed" ? new Date() : undefined }).where(and(eq(roomServiceRequestsTable.id, requestId), eq(roomServiceRequestsTable.restaurantId, restaurantId))).returning();
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(request);
});

export default router;
