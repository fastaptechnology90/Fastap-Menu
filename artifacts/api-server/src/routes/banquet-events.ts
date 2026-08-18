import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, banquetEventsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/events", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const rows = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.restaurantId, id)).orderBy(desc(banquetEventsTable.createdAt));
  res.json(rows.map(r => ({
    ...r,
    advancePaid: parseFloat(String(r.advancePaid ?? 0)),
    totalAmount: parseFloat(String(r.totalAmount ?? 0)),
  })));
});

router.post("/restaurants/:restaurantId/events", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, type, eventDate, eventTime, guestCount, venue, status, advancePaid, totalAmount, contactName, contactPhone, menu, notes, catering, decor, staffAssigned } = req.body;
  const [row] = await db.insert(banquetEventsTable).values({
    restaurantId: id,
    name: name || "New Event",
    type: type || "enquiry",
    eventDate: eventDate ? new Date(eventDate) : undefined,
    eventTime,
    guestCount: parseInt(String(guestCount)) || 0,
    venue,
    status: status || "enquiry",
    advancePaid: String(parseFloat(advancePaid) || 0),
    totalAmount: String(parseFloat(totalAmount) || 0),
    contactName,
    contactPhone,
    menu,
    notes,
    catering: Boolean(catering),
    decor: Boolean(decor),
    staffAssigned: staffAssigned ?? [],
  }).returning();
  res.status(201).json(row);
});

router.put("/restaurants/:restaurantId/events/:eventId", requireAuth, async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const body = req.body;
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "type", "eventTime", "venue", "status", "contactName", "contactPhone", "menu", "notes", "catering", "decor", "staffAssigned"]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.eventDate) patch.eventDate = new Date(body.eventDate);
  if (body.guestCount !== undefined) patch.guestCount = parseInt(String(body.guestCount)) || 0;
  if (body.advancePaid !== undefined) patch.advancePaid = String(parseFloat(body.advancePaid) || 0);
  if (body.totalAmount !== undefined) patch.totalAmount = String(parseFloat(body.totalAmount) || 0);
  const [row] = await db.update(banquetEventsTable).set(patch).where(and(eq(banquetEventsTable.id, eventId), eq(banquetEventsTable.restaurantId, restaurantId))).returning();
  if (!row) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(row);
});

router.delete("/restaurants/:restaurantId/events/:eventId", requireAuth, async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(banquetEventsTable).where(and(eq(banquetEventsTable.id, eventId), eq(banquetEventsTable.restaurantId, restaurantId)));
  res.json({ success: true });
});

export default router;
