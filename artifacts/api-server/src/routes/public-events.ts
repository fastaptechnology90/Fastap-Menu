import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, banquetEventsTable, restaurantsTable } from "@workspace/db";
import { buildQuotation, getCatalog } from "../lib/eventBanquetLogic.js";
import { loadCatalogSection } from "../lib/restaurant-catalogs.js";

const router: IRouter = Router();

router.get("/public/events/catalog/:restaurantId", async (req, res): Promise<void> => {
  const eventType = req.query.eventType as string | undefined;
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const overrides = await loadCatalogSection(restaurantId, "eventCatalog", {});
  res.json({ ...getCatalog(eventType, overrides), restaurantName: restaurant.name, live: true });
});

router.get("/public/events/my", async (req, res): Promise<void> => {
  const phone = req.query.phone as string;
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  if (!phone || !restaurantId) { res.status(400).json({ error: "phone and restaurantId required" }); return; }
  const list = await db.select().from(banquetEventsTable).where(
    and(eq(banquetEventsTable.restaurantId, restaurantId), eq(banquetEventsTable.contactPhone, phone)),
  ).orderBy(desc(banquetEventsTable.createdAt));
  res.json(list);
});

router.post("/public/events/quotation", async (req, res): Promise<void> => {
  const { hallId, guestCount, cateringPackageId, decorationPackageId } = req.body;
  if (!hallId || !guestCount) { res.status(400).json({ error: "hallId and guestCount required" }); return; }
  const quotation = buildQuotation(hallId, parseInt(guestCount, 10), cateringPackageId ?? "standard", decorationPackageId ?? "minimal");
  res.json({ quotation, validUntil: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.get("/public/events/detail/:eventId", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  const [event] = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(event);
});

router.post("/public/events/enquiry", async (req, res): Promise<void> => {
  const {
    restaurantId, name, type, eventDate, eventTime, guestCount, contactName, contactPhone,
    notes, venue, hallId, seatingLayout, cateringPackageId, decorationPackageId,
    guestInvitations, quotation,
  } = req.body;
  if (!restaurantId || !name) { res.status(400).json({ error: "restaurantId and name required" }); return; }

  const guests = parseInt(guestCount, 10) || 0;
  const quote = quotation ?? buildQuotation(hallId ?? "grand_hall", guests, cateringPackageId ?? "standard", decorationPackageId ?? "minimal");

  const [event] = await db.insert(banquetEventsTable).values({
    restaurantId,
    name,
    type: type || "corporate",
    eventDate: eventDate ? new Date(eventDate) : null,
    eventTime: eventTime ?? null,
    guestCount: guests,
    contactName,
    contactPhone,
    notes,
    venue: venue ?? hallId,
    status: "enquiry",
    catering: true,
    decor: Boolean(decorationPackageId),
    totalAmount: String(quote.total),
    advancePaid: String(quote.advance),
    metadata: {
      hallId,
      seatingLayout,
      cateringPackageId,
      decorationPackageId,
      quotation: quote,
      guestInvitations: guestInvitations ?? [],
      enquiryToken: `EVT-${randomBytes(4).toString("hex").toUpperCase()}`,
    },
  }).returning();

  const meta = event.metadata as Record<string, unknown> | null;
  res.status(201).json({ ...event, quotation: quote, enquiryToken: meta?.enquiryToken });
});

router.post("/public/events/:eventId/invitations", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  const { invitations } = req.body as { invitations: { name: string; phone?: string; email?: string }[] };
  const [event] = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const meta = (typeof event.metadata === "object" && event.metadata ? event.metadata : {}) as Record<string, unknown>;
  const existing = Array.isArray(meta.guestInvitations) ? meta.guestInvitations as Record<string, unknown>[] : [];
  const newInvites = (invitations ?? []).map(inv => ({
    id: randomBytes(4).toString("hex"),
    name: inv.name,
    phone: inv.phone,
    email: inv.email,
    status: "sent",
    sentAt: new Date().toISOString(),
  }));
  const merged = [...existing, ...newInvites];

  const [updated] = await db.update(banquetEventsTable).set({
    metadata: { ...meta, guestInvitations: merged },
  }).where(eq(banquetEventsTable.id, eventId)).returning();

  res.json({ guestInvitations: merged, event: updated, sent: newInvites.length });
});

router.patch("/public/events/:eventId/invitations/:inviteId", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  const { status } = req.body;
  const [event] = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.id, eventId));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const meta = (typeof event.metadata === "object" && event.metadata ? event.metadata : {}) as Record<string, unknown>;
  const invites = (Array.isArray(meta.guestInvitations) ? meta.guestInvitations : []) as Record<string, unknown>[];
  const updatedInvites = invites.map(inv =>
    inv.id === req.params.inviteId ? { ...inv, status: status ?? inv.status } : inv,
  );

  await db.update(banquetEventsTable).set({ metadata: { ...meta, guestInvitations: updatedInvites } }).where(eq(banquetEventsTable.id, eventId));
  res.json({ guestInvitations: updatedInvites });
});

router.get("/public/events/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  if (Number.isNaN(restaurantId)) { res.status(400).json({ error: "Invalid restaurant id" }); return; }
  const events = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.restaurantId, restaurantId));
  res.json(events);
});

export default router;
