import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, roomServiceRequestsTable, hotelRoomsTable, menuItemsTable, categoriesTable, ordersTable, DEFAULT_ROOM_CONTROLS } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection } from "../lib/restaurant-settings";
import { autoAssignRoomServiceRequest } from "../lib/staff-auto-assignment.js";
import { computeRoomFolio, mergeRoomBilling } from "../lib/hotel-folio.js";
import { parseMoney } from "../lib/payment-calculations.js";

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

/** Pull rate/discount/guestCount out of the body into a billing patch (only set keys). */
function billingPatchFromBody(body: Record<string, unknown>): { rate?: number; discount?: number; guestCount?: number } {
  const patch: { rate?: number; discount?: number; guestCount?: number } = {};
  if (body.rate != null && body.rate !== "") patch.rate = parseMoney(body.rate);
  if (body.discount != null && body.discount !== "") patch.discount = parseMoney(body.discount);
  if (body.guestCount != null && body.guestCount !== "") patch.guestCount = parseInt(String(body.guestCount), 10) || 1;
  return patch;
}

router.post("/restaurants/:restaurantId/rooms", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { number, type, floor, status, guestName, guestPhone, checkIn, checkOut, notes } = req.body;
  const patch = billingPatchFromBody(req.body);
  const roomControls = Object.keys(patch).length ? mergeRoomBilling(DEFAULT_ROOM_CONTROLS, patch) : undefined;
  const [room] = await db.insert(hotelRoomsTable).values({
    restaurantId: id, number, type, floor: parseInt(floor) || 1, status, guestName, guestPhone, notes,
    checkIn: checkIn ? new Date(checkIn) : undefined, checkOut: checkOut ? new Date(checkOut) : undefined,
    ...(roomControls ? { roomControls } : {}),
  }).returning();
  res.status(201).json(room);
});

router.put("/restaurants/:restaurantId/rooms/:roomId", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, guestName, guestPhone, checkIn, checkOut, notes } = req.body;
  const patch = billingPatchFromBody(req.body);
  let roomControls: Record<string, unknown> | undefined;
  if (Object.keys(patch).length) {
    const [existing] = await db.select().from(hotelRoomsTable).where(and(eq(hotelRoomsTable.id, roomId), eq(hotelRoomsTable.restaurantId, restaurantId)));
    roomControls = mergeRoomBilling(existing?.roomControls ?? DEFAULT_ROOM_CONTROLS, patch);
  }
  const [room] = await db.update(hotelRoomsTable).set({
    status, guestName, guestPhone, notes,
    checkIn: checkIn ? new Date(checkIn) : undefined, checkOut: checkOut ? new Date(checkOut) : undefined,
    ...(roomControls ? { roomControls } : {}),
  }).where(and(eq(hotelRoomsTable.id, roomId), eq(hotelRoomsTable.restaurantId, restaurantId))).returning();
  if (!room) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(room);
});

// ── Room folio (running bill) ────────────────────────────────────────────────
router.get("/restaurants/:restaurantId/rooms/:roomNumber/folio", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const folio = await computeRoomFolio(restaurantId, req.params.roomNumber);
  res.json(folio);
});

// Check-out: settle the folio, free the room. Returns the final bill.
router.post("/restaurants/:restaurantId/rooms/:roomNumber/checkout", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const roomNumber = req.params.roomNumber;
  const folio = await computeRoomFolio(restaurantId, roomNumber);
  // Close out any open service requests for this room.
  await db.update(roomServiceRequestsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(roomServiceRequestsTable.restaurantId, restaurantId), eq(roomServiceRequestsTable.roomNumber, roomNumber)));
  // Free the room and clear the guest + billing.
  await db.update(hotelRoomsTable)
    .set({ status: "vacant", guestName: null, guestPhone: null, checkIn: null, checkOut: null, roomControls: mergeRoomBilling(DEFAULT_ROOM_CONTROLS, { rate: 0, discount: 0, guestCount: 1 }) })
    .where(and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)));
  res.json({ checkedOut: true, roomNumber, finalTotal: folio.total, folio });
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

  // Food / bar charges also mirror into a kitchen order (type "room_service") so the
  // kitchen app and finance/revenue see them. The folio reads the request (above), the
  // kitchen/finance read this order — same amount in each, no double count.
  if (type === "food" || type === "bar") {
    try {
      const orderItems = (Array.isArray(items) ? items : []).map((i: any, idx: number) => {
        const qty = Number(i.qty ?? i.quantity ?? 1) || 1;
        const price = parseMoney(i.price);
        return { id: idx + 1, name: i.name ?? i.description ?? "Item", price, quantity: qty, subtotal: price * qty };
      });
      const totalNum = parseFloat(total) || 0;
      await db.insert(ordersTable).values({
        restaurantId: id, tableName: `Room ${roomNumber}`, customerName: guestName ?? "Room Guest",
        type: "room_service", status: "pending", items: orderItems.length ? orderItems : [{ id: 1, name: notes || "Room service", price: totalNum, quantity: 1, subtotal: totalNum }],
        subtotal: String(totalNum.toFixed(2)), tax: "0.00", total: String(totalNum.toFixed(2)),
        notes: notes ?? null, paymentMethod: paymentMethod ?? "room_bill", paymentStatus: "pending",
        orderSource: "room_service",
        metadata: { roomNumber, roomServiceRequestId: request.id, folioMirror: true, source: type },
      });
    } catch (e) { console.error("room-service kitchen mirror order failed", e); }
  }

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
