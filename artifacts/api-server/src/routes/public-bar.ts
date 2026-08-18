import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, restaurantsTable, menuItemsTable, categoriesTable,
  reservationsTable, banquetEventsTable,
} from "@workspace/db";
import {
  getBarCatalog, cocktailQuote, filterHappyHourItems, isHappyHourActive, DJ_EVENTS, BAR_TABLES, LOUNGE_ZONES,
} from "../lib/barNightlifeLogic.js";
import { generateBookingToken } from "../lib/reservationLogic.js";
import { loadCatalogSection } from "../lib/restaurant-catalogs.js";

const router: IRouter = Router();

router.get("/public/bar/catalog/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const overrides = await loadCatalogSection(restaurantId, "barCatalog", {});
  res.json({ ...getBarCatalog(), ...overrides, restaurantName: restaurant.name, live: true });
});

router.get("/public/bar/happy-hour/:slug", async (req, res): Promise<void> => {
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, req.params.slug));
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }

  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurant.id));
  const catById = Object.fromEntries(categories.map(c => [c.id, c.slug]));
  const items = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));

  const mapped = items.map(i => ({
    id: i.id,
    name: i.name,
    price: i.price,
    description: i.description,
    categorySlug: catById[i.categoryId ?? 0] ?? "",
  }));

  const happyHourItems = filterHappyHourItems(mapped);
  res.json({
    happyHour: getBarCatalog().happyHour,
    isActive: isHappyHourActive(),
    items: happyHourItems,
    restaurantName: restaurant.name,
  });
});

router.post("/public/bar/cocktail", async (req, res): Promise<void> => {
  const { baseId, mixerId, styleId, garnishIds, name } = req.body;
  const quote = cocktailQuote(baseId ?? "rum", styleId ?? "regular", garnishIds ?? []);
  const cocktailName = name ?? `Custom ${baseId ?? "rum"} cocktail`;
  res.json({
    name: cocktailName,
    ...quote,
    recipe: { baseId, mixerId, styleId, garnishIds },
  });
});

router.get("/public/bar/table-slots", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  const date = String(req.query.date || "");
  const tableId = String(req.query.tableId || "");
  if (!restaurantId || !date) { res.status(400).json({ error: "restaurantId and date required" }); return; }

  const booked = await db.select().from(reservationsTable).where(
    and(eq(reservationsTable.restaurantId, restaurantId), eq(reservationsTable.date, date), eq(reservationsTable.status, "confirmed")),
  );
  const tableBookings = booked.filter(b => b.reservationType === "bar_table" || b.zone?.includes("bar"));

  const slots = getBarCatalog().timeSlots.map(time => {
    const taken = tableBookings.some(b => b.time === time && (!tableId || b.notes?.includes(tableId)));
    return { time, label: time, available: !taken };
  });

  res.json({ date, tableId, slots, tables: BAR_TABLES });
});

router.post("/public/bar/table-reservation", async (req, res): Promise<void> => {
  const { restaurantId, customerName, customerPhone, date, time, guestCount, tableId, notes } = req.body;
  if (!restaurantId || !customerName || !date || !time) {
    res.status(400).json({ error: "Required fields missing" }); return;
  }
  const table = BAR_TABLES.find(t => t.id === tableId);
  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone: customerPhone ?? "",
    date,
    time,
    guestCount: guestCount ?? 2,
    reservationType: "bar_table",
    zone: table?.zone ?? "Sunset Lounge",
    notes: `Bar table: ${table?.name ?? tableId}. ${notes ?? ""}`,
    depositAmount: "300",
    depositStatus: "pending",
    status: "confirmed",
  }).returning();

  const token = generateBookingToken(reservation.id);
  const [updated] = await db.update(reservationsTable).set({ bookingToken: token }).where(eq(reservationsTable.id, reservation.id)).returning();
  res.status(201).json({ ...(updated ?? reservation), table: table ?? { id: tableId } });
});

router.post("/public/bar/lounge-booking", async (req, res): Promise<void> => {
  const { restaurantId, customerName, customerPhone, date, time, guestCount, loungeId, notes } = req.body;
  if (!restaurantId || !customerName || !date || !time) {
    res.status(400).json({ error: "Required fields missing" }); return;
  }
  const lounge = LOUNGE_ZONES.find(l => l.id === loungeId) ?? LOUNGE_ZONES[0];
  const [reservation] = await db.insert(reservationsTable).values({
    restaurantId,
    customerName,
    customerPhone: customerPhone ?? "",
    date,
    time,
    guestCount: guestCount ?? lounge.capacity,
    reservationType: "lounge",
    zone: lounge.id,
    notes: `Premium lounge: ${lounge.name}. Min spend ₹${lounge.minSpend}. ${notes ?? ""}`,
    depositAmount: String(lounge.deposit),
    depositStatus: "pending",
    status: "confirmed",
  }).returning();

  const token = generateBookingToken(reservation.id);
  const [updated] = await db.update(reservationsTable).set({ bookingToken: token }).where(eq(reservationsTable.id, reservation.id)).returning();
  res.status(201).json({ ...(updated ?? reservation), lounge });
});

router.post("/public/bar/dj-booking", async (req, res): Promise<void> => {
  const { restaurantId, customerName, customerPhone, guestCount, djEventId, eventDate, notes } = req.body;
  if (!restaurantId || !customerName || !djEventId) {
    res.status(400).json({ error: "Required fields missing" }); return;
  }
  const dj = DJ_EVENTS.find(d => d.id === djEventId) ?? DJ_EVENTS[0];
  const [event] = await db.insert(banquetEventsTable).values({
    restaurantId,
    name: dj.name,
    type: "dj_event",
    eventDate: eventDate ? new Date(eventDate) : new Date(),
    eventTime: dj.time,
    guestCount: guestCount ?? 2,
    venue: "Sunset Lounge / Dance Floor",
    contactName: customerName,
    contactPhone: customerPhone,
    notes,
    status: "confirmed",
    totalAmount: String(dj.cover * (guestCount ?? 2)),
    advancePaid: String(dj.cover),
    metadata: { djEventId, genre: dj.genre, coverCharge: dj.cover },
  }).returning();

  res.status(201).json({ ...event, djEvent: dj });
});

export default router;
