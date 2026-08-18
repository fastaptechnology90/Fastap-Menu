import { Router, type IRouter } from "express";
import { eq, and, or, sql, ilike } from "drizzle-orm";
import {
  db,
  restaurantsTable,
  tablesMapTable,
  hotelRoomsTable,
  qrCodesTable,
  tableAreasTable,
} from "@workspace/db";
import { buildScanUrl } from "../lib/scan-urls.js";
import { canAccessGuestVenue, getPublicationStatus, guestVenueAccessError } from "../lib/restaurant-publication.js";

const router: IRouter = Router();

const TABLE_STATUS_LABEL: Record<string, string> = {
  free: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Being cleaned",
  billing: "Billing in progress",
  waiting_food: "Waiting for food",
  maintenance: "Unavailable",
  vip_occupied: "VIP occupied",
  blocked: "Blocked",
  under_service: "Under service",
};

const ROOM_STATUS_LABEL: Record<string, string> = {
  vacant: "Available",
  occupied: "Occupied",
  cleaning: "Being cleaned",
  maintenance: "Maintenance",
  reserved: "Reserved",
};

async function bumpQrScan(restaurantId: number, opts: { tableId?: number; tableName?: string; room?: string }) {
  const conditions = [eq(qrCodesTable.restaurantId, restaurantId)];
  if (opts.tableId) {
    await db.update(qrCodesTable).set({
      scans: sql`${qrCodesTable.scans} + 1`,
      updatedAt: new Date(),
    }).where(and(...conditions, eq(qrCodesTable.tableId, opts.tableId)));
    return;
  }
  if (opts.tableName) {
    await db.update(qrCodesTable).set({
      scans: sql`${qrCodesTable.scans} + 1`,
      updatedAt: new Date(),
    }).where(and(
      ...conditions,
      or(
        eq(qrCodesTable.label, opts.tableName),
        ilike(qrCodesTable.url, `%table=${opts.tableName}%`),
      ),
    ));
    return;
  }
  if (opts.room) {
    await db.update(qrCodesTable).set({
      scans: sql`${qrCodesTable.scans} + 1`,
      updatedAt: new Date(),
    }).where(and(
      ...conditions,
      eq(qrCodesTable.type, "room"),
      or(
        eq(qrCodesTable.label, opts.room),
        ilike(qrCodesTable.url, `%room=${opts.room}%`),
      ),
    ));
  }
}

router.get("/public/scan/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug;
  const tableParam = typeof req.query.table === "string" ? req.query.table : undefined;
  const roomParam = typeof req.query.room === "string" ? req.query.room : undefined;

  if (!tableParam && !roomParam) {
    res.status(400).json({ error: "Scan requires ?table= or ?room= parameter" });
    return;
  }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug));
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  if (!canAccessGuestVenue(restaurant)) {
    res.status(403).json({ error: guestVenueAccessError(getPublicationStatus(restaurant)) });
    return;
  }

  req.session.restaurantId = restaurant.id;

  if (tableParam) {
    const tables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurant.id));
    const table = tables.find(t => t.name === tableParam || String(t.id) === tableParam) ?? null;

    if (!table) {
      res.status(404).json({ error: "Table not found", restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } });
      return;
    }

    await bumpQrScan(restaurant.id, { tableId: table.id, tableName: table.name });

    const areas = await db.select().from(tableAreasTable).where(eq(tableAreasTable.restaurantId, restaurant.id));
    const area = table.zone ? areas.find(a => a.name === table.zone) : areas.find(a => a.id === table.areaId);

    const bookable = ["free", "reserved"].includes(table.status);
    const scanUrl = buildScanUrl(slug, { table: table.name, entry: "qr" });

    res.json({
      type: "table",
      scannedAt: new Date().toISOString(),
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        logoUrl: restaurant.logoUrl,
        businessType: restaurant.businessType,
      },
      table: {
        id: table.id,
        name: table.name,
        status: table.status,
        statusLabel: TABLE_STATUS_LABEL[table.status] ?? table.status,
        zone: table.zone,
        areaName: area?.name ?? table.zone,
        capacity: table.capacity,
        tableType: table.tableType,
        isVip: table.isVip,
        bookable,
        canOrder: table.status !== "blocked" && table.status !== "maintenance",
      },
      room: null,
      actions: {
        reserve: `/user/reserve?slug=${slug}&table=${encodeURIComponent(table.name)}`,
        menu: `/user/menu?slug=${slug}&table=${encodeURIComponent(table.name)}&entry=qr`,
        seating: `/user/seating?slug=${slug}&table=${encodeURIComponent(table.name)}`,
        scanUrl,
      },
    });
    return;
  }

  let [room] = await db.select().from(hotelRoomsTable).where(
    and(eq(hotelRoomsTable.restaurantId, restaurant.id), eq(hotelRoomsTable.number, roomParam!)),
  );

  if (!room) {
    [room] = await db.insert(hotelRoomsTable).values({
      restaurantId: restaurant.id,
      number: roomParam!,
      type: "standard",
      floor: parseInt(roomParam!.replace(/\D/g, "")[0] || "1", 10) || 1,
      status: "vacant",
    }).returning();
  }

  await bumpQrScan(restaurant.id, { room: room.number });

  const bookable = ["vacant", "reserved"].includes(room.status);
  const scanUrl = buildScanUrl(slug, { room: room.number, entry: "room_qr" });

  res.json({
    type: "room",
    scannedAt: new Date().toISOString(),
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.address,
      logoUrl: restaurant.logoUrl,
      businessType: restaurant.businessType,
    },
    table: null,
    room: {
      id: room.id,
      number: room.number,
      type: room.type,
      floor: room.floor,
      status: room.status,
      statusLabel: ROOM_STATUS_LABEL[room.status] ?? room.status,
      guestName: room.guestName,
      checkIn: room.checkIn,
      checkOut: room.checkOut,
      bookable,
      canOrder: room.status !== "maintenance",
    },
    actions: {
      hotel: `/user/hotel?slug=${slug}&room=${encodeURIComponent(room.number)}`,
      menu: `/user/menu?slug=${slug}&room=${encodeURIComponent(room.number)}&entry=room_qr`,
      reserve: `/user/reserve?slug=${slug}&room=${encodeURIComponent(room.number)}`,
      scanUrl,
    },
  });
});

export default router;
