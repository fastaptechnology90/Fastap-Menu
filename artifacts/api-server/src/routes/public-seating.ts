import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  restaurantsTable,
  tablesMapTable,
  tableSeatingRequestsTable,
  queueEntriesTable,
} from "@workspace/db";
import {
  TABLE_STATUSES,
  TABLE_TYPE_CATALOG,
  suggestTables,
  detectSeatCapacity,
  estimateWaitMinutes,
  estimateQueuePosition,
  generateSeatingToken,
  isTableAvailable,
} from "../lib/smart-seating.js";
import { canAccessGuestVenue } from "../lib/restaurant-publication.js";

const router: IRouter = Router();

async function getRestaurantBySlug(slug: string) {
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
  return r && canAccessGuestVenue(r) ? r : null;
}

function mapTable(t: typeof tablesMapTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    zone: t.zone,
    capacity: t.capacity,
    status: t.status,
    tableType: t.tableType ?? "4_seater",
    tableCategory: t.tableCategory ?? "restaurant",
    isVip: t.isVip,
    currentGuestCount: t.currentGuestCount,
    available: isTableAvailable(t.status),
    seatCapacity: detectSeatCapacity(t, t.currentGuestCount || 0),
  };
}

router.get("/public/seating/catalog", (_req, res) => {
  res.json({ statuses: TABLE_STATUSES, typeCatalog: TABLE_TYPE_CATALOG });
});

router.get("/public/seating/:slug/availability", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }

  const category = req.query.category as string | undefined;
  const tableType = req.query.tableType as string | undefined;
  const zone = req.query.zone as string | undefined;
  const statusFilter = req.query.status as string | undefined;

  let tables = await db.select().from(tablesMapTable).where(
    and(eq(tablesMapTable.restaurantId, restaurant.id), eq(tablesMapTable.isActive, true)),
  );

  if (category) tables = tables.filter(t => t.tableCategory === category);
  if (tableType) tables = tables.filter(t => t.tableType === tableType);
  if (zone) tables = tables.filter(t => (t.zone ?? "").toLowerCase().includes(zone.toLowerCase()));
  if (statusFilter) tables = tables.filter(t => t.status === statusFilter);

  const byStatus = Object.fromEntries(TABLE_STATUSES.map(s => [s.id, tables.filter(t => t.status === s.id).length]));
  const byCategory = Object.fromEntries(
    Object.keys(TABLE_TYPE_CATALOG).map(cat => [cat, tables.filter(t => t.tableCategory === cat).length]),
  );
  const free = tables.filter(t => isTableAvailable(t.status));

  res.json({
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    live: true,
    total: tables.length,
    freeCount: free.length,
    occupiedCount: tables.length - free.length,
    byStatus,
    byCategory,
    tables: tables.map(mapTable),
    typeCatalog: TABLE_TYPE_CATALOG,
    statuses: TABLE_STATUSES,
  });
});

router.get("/public/seating/:slug/suggestions", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }

  const partySize = parseInt(String(req.query.partySize ?? "2"), 10);
  const category = req.query.category as string | undefined;
  const zone = req.query.zone as string | undefined;
  const preferVip = req.query.vip === "1" || req.query.vip === "true";

  const tables = await db.select().from(tablesMapTable).where(
    and(eq(tablesMapTable.restaurantId, restaurant.id), eq(tablesMapTable.isActive, true)),
  );

  const suggestions = suggestTables(
    tables.map(t => ({
      id: t.id,
      name: t.name,
      zone: t.zone,
      capacity: t.capacity,
      status: t.status,
      tableType: t.tableType ?? "4_seater",
      tableCategory: t.tableCategory ?? "restaurant",
      isVip: t.isVip,
      currentGuestCount: t.currentGuestCount,
    })),
    partySize,
    { preferVip, category, zone },
  );

  res.json({
    partySize,
    suggestions,
    seatCapacityDetection: suggestions[0]
      ? detectSeatCapacity(suggestions[0], partySize)
      : { canAccommodate: false, message: "No free tables match your party size" },
  });
});

router.get("/public/seating/:slug/wait-estimate", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }

  const partySize = parseInt(String(req.query.partySize ?? "2"), 10);

  const [tables, queueRows] = await Promise.all([
    db.select().from(tablesMapTable).where(and(eq(tablesMapTable.restaurantId, restaurant.id), eq(tablesMapTable.isActive, true))),
    db.select().from(queueEntriesTable).where(
      and(eq(queueEntriesTable.restaurantId, restaurant.id), eq(queueEntriesTable.status, "waiting")),
    ),
  ]);

  const freeCount = tables.filter(t => isTableAvailable(t.status)).length;
  const queueLength = queueRows.length;
  const estimatedWait = estimateWaitMinutes(freeCount, queueLength, partySize);
  const queuePosition = estimateQueuePosition(queueLength);

  res.json({
    partySize,
    freeTables: freeCount,
    queueLength,
    estimatedWaitMinutes: estimatedWait,
    estimatedQueuePosition: queuePosition,
    queueEstimation: {
      waitTimePrediction: estimatedWait,
      queueEstimation: queueLength,
      tablesAvailable: freeCount > 0,
    },
  });
});

async function createSeatingRequest(
  restaurantId: number,
  body: {
    requestType: string;
    fromTableId?: number;
    toTableId?: number;
    targetTableIds?: number[];
    partySize?: number;
    guestName?: string;
    guestPhone?: string;
    notes?: string;
  },
) {
  const token = generateSeatingToken();
  const [req_row] = await db.insert(tableSeatingRequestsTable).values({
    restaurantId,
    requestType: body.requestType,
    token,
    fromTableId: body.fromTableId ?? null,
    toTableId: body.toTableId ?? null,
    targetTableIds: body.targetTableIds ?? [],
    partySize: body.partySize ?? 2,
    guestName: body.guestName ?? null,
    guestPhone: body.guestPhone ?? null,
    notes: body.notes ?? null,
    status: "pending",
  }).returning();
  return req_row;
}

router.post("/public/seating/:slug/join-request", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const { fromTableId, targetTableIds, partySize, guestName, guestPhone, notes } = req.body;
  try {
    const request = await createSeatingRequest(restaurant.id, {
      requestType: "join",
      fromTableId,
      targetTableIds: targetTableIds ?? (fromTableId ? [fromTableId] : []),
      partySize,
      guestName,
      guestPhone,
      notes,
    });
    res.status(201).json({ request, message: "Table join request submitted" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not submit join request" });
  }
});

router.post("/public/seating/:slug/split-request", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const { fromTableId, partySize, guestName, guestPhone, notes } = req.body;
  if (!fromTableId) { res.status(400).json({ error: "fromTableId required" }); return; }
  try {
    const request = await createSeatingRequest(restaurant.id, {
      requestType: "split",
      fromTableId,
      partySize,
      guestName,
      guestPhone,
      notes,
    });
    res.status(201).json({ request, message: "Table split request submitted" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not submit split request" });
  }
});

router.post("/public/seating/:slug/transfer-request", async (req, res): Promise<void> => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const { fromTableId, toTableId, guestName, guestPhone, notes } = req.body;
  if (!fromTableId || !toTableId) { res.status(400).json({ error: "fromTableId and toTableId required" }); return; }
  try {
    const request = await createSeatingRequest(restaurant.id, {
      requestType: "transfer",
      fromTableId,
      toTableId,
      guestName,
      guestPhone,
      notes,
    });
    res.status(201).json({ request, message: "Table transfer request submitted" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not submit transfer request" });
  }
});

router.get("/public/seating/request/:token", async (req, res): Promise<void> => {
  try {
    const [request] = await db.select().from(tableSeatingRequestsTable).where(eq(tableSeatingRequestsTable.token, req.params.token));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    res.json({ request });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not load request" });
  }
});

export default router;
