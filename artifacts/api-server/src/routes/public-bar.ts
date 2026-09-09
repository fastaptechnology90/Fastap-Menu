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

interface BarCatalogOverrides {
  happyHour?: { label?: string; days?: string; start?: string; end?: string; discountPercent?: number };
  djEvents?: unknown[];
  barTables?: unknown[];
  loungeZones?: unknown[];
  timeSlots?: unknown[];
  cocktailBases?: unknown[];
}

/**
 * The bar programme this venue actually runs.
 *
 * Every venue on the platform used to be handed the same invented nightlife: a happy
 * hour from 16:00 to 19:00 Monday to Friday at 20% off, four DJ nights with named DJs
 * — "Friday Night DJ — DJ Aakash", ₹500 cover — bar tables, lounge zones and a priced
 * cocktail builder, all stamped `live: true`. A family restaurant with no bar showed a
 * guest another business's Saturday line-up as its own, and the cover charges were
 * numbers nobody at the venue had ever agreed to.
 *
 * Nothing is offered now unless the venue has published it in its own settings.
 */
router.get("/public/bar/catalog/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const overrides = await loadCatalogSection<BarCatalogOverrides>(restaurantId, "barCatalog", {});

  const list = (v: unknown) => (Array.isArray(v) && v.length ? v : []);
  const happyHour = overrides.happyHour && typeof overrides.happyHour === "object" ? overrides.happyHour : null;
  const djEvents = list(overrides.djEvents);
  const barTables = list(overrides.barTables);
  const loungeZones = list(overrides.loungeZones);
  const cocktailBases = list(overrides.cocktailBases);
  const configured = Boolean(happyHour) || djEvents.length > 0 || barTables.length > 0 || loungeZones.length > 0;

  res.json({
    happyHour,
    isHappyHourNow: happyHour ? isHappyHourActive() : false,
    djEvents,
    barTables,
    loungeZones,
    timeSlots: list(overrides.timeSlots),
    cocktailBases,
    restaurantName: restaurant.name,
    configured,
    live: configured,
    notice: configured
      ? null
      : `${restaurant.name} has not published a bar or nightlife programme. Drinks on the menu can still be ordered from your table.`,
  });
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

  // A venue that has not set a happy hour does not have one. This used to discount its
  // whole drinks list by 20% between 16:00 and 19:00 on a schedule invented in code —
  // a price the venue never agreed to, shown to the guest as its offer.
  const barOverrides = await loadCatalogSection<BarCatalogOverrides>(restaurant.id, "barCatalog", {});
  const publishedHappyHour = barOverrides.happyHour && typeof barOverrides.happyHour === "object" ? barOverrides.happyHour : null;
  if (!publishedHappyHour) {
    res.json({
      happyHour: null,
      isActive: false,
      items: [],
      restaurantName: restaurant.name,
      configured: false,
      notice: `${restaurant.name} is not running a happy hour.`,
    });
    return;
  }

  const happyHourItems = filterHappyHourItems(mapped);
  res.json({
    happyHour: publishedHappyHour,
    isActive: isHappyHourActive(),
    items: happyHourItems,
    restaurantName: restaurant.name,
    configured: true,
  });
});

router.post("/public/bar/cocktail", async (req, res): Promise<void> => {
  const { restaurantId, baseId, mixerId, styleId, garnishIds, name } = req.body;

  // The builder priced a drink from spirit and garnish rates written into the source,
  // then had no way to send it to a bartender. Quoting a price a venue never set, for a
  // drink nobody can make, is worse than not offering it.
  const rid = parseInt(String(restaurantId ?? 0), 10);
  const cocktailOverrides = rid ? await loadCatalogSection<BarCatalogOverrides>(rid, "barCatalog", {}) : {};
  if (!Array.isArray(cocktailOverrides.cocktailBases) || cocktailOverrides.cocktailBases.length === 0) {
    res.status(409).json({
      error: "This venue does not offer build-your-own cocktails. Please order from the drinks menu.",
      configured: false,
    });
    return;
  }

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
    // The cover charge is collected at the door. Recording it as already paid on a
    // booking made from the guest's phone credited the venue money it never took.
    advancePaid: "0",
    metadata: { djEventId, genre: dj.genre, coverCharge: dj.cover },
  }).returning();

  res.status(201).json({ ...event, djEvent: dj });
});

export default router;
