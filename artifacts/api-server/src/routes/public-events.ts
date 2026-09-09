import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, banquetEventsTable, restaurantsTable } from "@workspace/db";
import { buildQuotation, getCatalog } from "../lib/eventBanquetLogic.js";
import { loadCatalogSection } from "../lib/restaurant-catalogs.js";

const router: IRouter = Router();

interface EventCatalogOverrides {
  halls?: { id: string; name: string; capacity?: number; rate?: number }[];
  cateringPackages?: { id: string; label: string; perGuest?: number }[];
  decorationPackages?: { id: string; label: string; price?: number }[];
  seatingLayouts?: unknown[];
  eventTypes?: unknown[];
}

/** A venue only offers banquet space once it has actually listed some. */
function hasPublishedSpaces(overrides: EventCatalogOverrides): boolean {
  return Array.isArray(overrides.halls) && overrides.halls.length > 0;
}

/**
 * What this venue can actually host.
 *
 * This used to answer with six named halls — "Grand Banquet Hall, 300 guests, ₹25,000",
 * a rooftop garden, a pool deck — for every restaurant on the platform, and stamp
 * `live: true` on top. None of it belonged to the venue being asked about: a 40-cover
 * restaurant in Bangalore and a hotel in Udaipur were handed the identical brochure,
 * and a guest could get a printed quotation for a hall that does not exist.
 *
 * A venue's halls, catering and decoration packages now come only from what it has
 * published in its own settings. A venue that has published nothing says so, and the
 * enquiry form still works — the events team replies with real availability and rates.
 */
router.get("/public/events/catalog/:restaurantId", async (req, res): Promise<void> => {
  const eventType = req.query.eventType as string | undefined;
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const overrides = await loadCatalogSection<EventCatalogOverrides>(restaurantId, "eventCatalog", {});
  const published = hasPublishedSpaces(overrides);
  const catalog = getCatalog(eventType, overrides as Parameters<typeof getCatalog>[1]);

  res.json({
    // Event types and seating layouts are industry vocabulary — "Wedding", "Theatre
    // style" — not claims about this venue, so they stay.
    eventTypes: catalog.eventTypes,
    seatingLayouts: catalog.seatingLayouts,
    halls: published ? catalog.halls : [],
    cateringPackages: published && Array.isArray(overrides.cateringPackages) ? overrides.cateringPackages : [],
    decorationPackages: published && Array.isArray(overrides.decorationPackages) ? overrides.decorationPackages : [],
    restaurantName: restaurant.name,
    configured: published,
    live: published,
    notice: published
      ? null
      : `${restaurant.name} has not published its event spaces or packages yet. Send an enquiry and the events team will reply with availability and rates.`,
  });
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
  const { restaurantId, hallId, guestCount, cateringPackageId, decorationPackageId } = req.body;
  if (!hallId || !guestCount) { res.status(400).json({ error: "hallId and guestCount required" }); return; }

  // An unknown hall id used to silently fall back to the first hall in a hardcoded list
  // and quote its ₹25,000 rate, so the guest walked away holding a price for a room the
  // venue does not have. A quotation is only issued against a space the venue published.
  const rid = parseInt(String(restaurantId ?? 0), 10);
  if (!rid) { res.status(400).json({ error: "restaurantId required" }); return; }
  const overrides = await loadCatalogSection<EventCatalogOverrides>(rid, "eventCatalog", {});
  if (!hasPublishedSpaces(overrides)) {
    res.status(409).json({
      error: "This venue has not published its event spaces or rates yet. Send an enquiry and the events team will quote for you.",
      configured: false,
    });
    return;
  }
  if (!overrides.halls!.some(h => h.id === hallId)) {
    res.status(404).json({ error: "That space is not one this venue offers." });
    return;
  }

  const quotation = buildQuotation(hallId, parseInt(guestCount, 10), cateringPackageId ?? "standard", decorationPackageId ?? "minimal");
  res.json({ quotation, validUntil: new Date(Date.now() + 7 * 86400000).toISOString() });
});

router.get("/public/events/detail/:eventId", async (req, res): Promise<void> => {
  const eventId = parseInt(String(req.params.eventId), 10);
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
  // An enquiry to a venue with no published halls used to be costed against "grand_hall"
  // — a hall from the hardcoded brochure — and that invented figure was written to the
  // event's `totalAmount`. A venue that has published nothing gets an enquiry with no
  // price on it, which is the truth: the team has yet to quote.
  const enquiryOverrides = await loadCatalogSection<EventCatalogOverrides>(parseInt(String(restaurantId), 10), "eventCatalog", {});
  const quotable = hasPublishedSpaces(enquiryOverrides) && hallId && enquiryOverrides.halls!.some(h => h.id === hallId);
  const quote = quotation ?? (quotable
    ? buildQuotation(hallId, guests, cateringPackageId ?? "standard", decorationPackageId ?? "minimal")
    : null);

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
    totalAmount: quote ? String(quote.total) : "0",
    // An enquiry is not a payment. Writing the quoted advance into `advancePaid` put
    // tens of thousands of rupees nobody had handed over into the venue's books, and
    // showed the events team a deposit as already collected. The figure the guest still
    // owes lives in the quotation.
    advancePaid: "0",
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
  res.status(201).json({
    ...event,
    quotation: quote,
    quoted: Boolean(quote),
    enquiryToken: meta?.enquiryToken,
    notice: quote ? null : "Your enquiry has reached the events team. They will come back to you with availability and a price.",
  });
});

router.post("/public/events/:eventId/invitations", async (req, res): Promise<void> => {
  const eventId = parseInt(String(req.params.eventId), 10);
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
  const eventId = parseInt(String(req.params.eventId), 10);
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
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  if (Number.isNaN(restaurantId)) { res.status(400).json({ error: "Invalid restaurant id" }); return; }
  const events = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.restaurantId, restaurantId));
  res.json(events);
});

export default router;
