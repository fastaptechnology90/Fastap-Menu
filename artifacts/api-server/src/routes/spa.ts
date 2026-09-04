import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, spaServicesTable, spaBookingsTable, roomServiceRequestsTable } from "@workspace/db";
import { recordAncillaryPaymentInLedger } from "../lib/order-payment-ledger.js";
import { requireAuth } from "../middlewares/auth";
import { parseMoney } from "../lib/payment-calculations.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/spa/services", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const services = await db.select().from(spaServicesTable).where(eq(spaServicesTable.restaurantId, id));
  res.json(services.map(s => ({ ...s, price: parseFloat(String(s.price)) })));
});

router.post("/restaurants/:restaurantId/spa/services", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, category, description, duration, price, therapist, isBar } = req.body;
  const [service] = await db.insert(spaServicesTable).values({ restaurantId: id, name, category, description, duration: parseInt(duration) || 60, price: String(parseFloat(price) || 0), therapist, isBar: Boolean(isBar) }).returning();
  res.status(201).json(service);
});

router.put("/restaurants/:restaurantId/spa/services/:serviceId", requireAuth, async (req, res): Promise<void> => {
  const serviceId = parseInt(req.params.serviceId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, category, description, duration, price, therapist, isAvailable } = req.body;
  const [service] = await db.update(spaServicesTable).set({ name, category, description, duration: duration ? parseInt(duration) : undefined, price: price !== undefined ? String(parseFloat(price)) : undefined, therapist, isAvailable }).where(and(eq(spaServicesTable.id, serviceId), eq(spaServicesTable.restaurantId, restaurantId))).returning();
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }
  res.json(service);
});

router.delete("/restaurants/:restaurantId/spa/services/:serviceId", requireAuth, async (req, res): Promise<void> => {
  const serviceId = parseInt(req.params.serviceId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(spaServicesTable).where(and(eq(spaServicesTable.id, serviceId), eq(spaServicesTable.restaurantId, restaurantId)));
  res.json({ message: "Service deleted" });
});

router.get("/restaurants/:restaurantId/spa/bookings", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const bookings = await db.select().from(spaBookingsTable).where(eq(spaBookingsTable.restaurantId, id)).orderBy(desc(spaBookingsTable.scheduledAt));
  res.json(bookings.map(b => ({ ...b, price: parseFloat(String(b.price)) })));
});

router.post("/restaurants/:restaurantId/spa/bookings", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { serviceId, serviceName, guestName, guestPhone, guestEmail, therapist, scheduledAt, duration, price, notes, roomNumber, discount } = req.body;
  // new Date(undefined) is an Invalid Date, and the ORM then calls toISOString()
  // on it and throws — the booking is lost with only a 500 to show for it.
  // A missing or malformed date should be reported, not crash the request.
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
    res.status(400).json({ error: "A valid scheduledAt date is required" });
    return;
  }
  const parsedPrice = parseFloat(price);
  const basePrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
  // Discount is auto-applied when a spa guest gives their room number (in-house perk).
  const room = typeof roomNumber === "string" && roomNumber.trim() ? roomNumber.trim() : null;
  const discountAmt = Math.min(basePrice, Math.max(0, parseMoney(discount)));
  const netPrice = Math.max(0, basePrice - discountAmt);
  const [booking] = await db.insert(spaBookingsTable).values({
    restaurantId: id, serviceId: serviceId ? parseInt(serviceId) : null, serviceName,
    guestName, guestPhone, guestEmail, therapist, scheduledAt: scheduledDate,
    duration: parseInt(duration) || 60, price: String(netPrice), notes,
    metadata: { roomNumber: room, discount: discountAmt, basePrice },
  }).returning();

  // If tied to a room, post the (discounted) charge to that room's folio.
  if (room) {
    try {
      await db.insert(roomServiceRequestsTable).values({
        restaurantId: id, roomNumber: room, guestName, guestPhone, type: "spa",
        items: [{ name: serviceName, qty: 1, price: netPrice }],
        notes: `Spa: ${serviceName}${discountAmt > 0 ? ` (₹${discountAmt} off)` : ""}`,
        total: String(netPrice), paymentMethod: "room_bill", status: "completed",
      });
    } catch (e) { console.error("spa folio charge failed", e); }
  }
  res.status(201).json(booking);
});

router.put("/restaurants/:restaurantId/spa/bookings/:bookingId", requireAuth, async (req, res): Promise<void> => {
  const bookingId = parseInt(req.params.bookingId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, therapist, notes, paymentStatus, payment } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (therapist !== undefined) updates.therapist = therapist;
  if (notes !== undefined) updates.notes = notes;
  if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
  // Spa Payments page: record HOW the payment was collected (method / upi id / utr / who)
  // into the booking metadata so the owner can click a payment and see full detail.
  if (payment && typeof payment === "object") {
    const [existing] = await db.select().from(spaBookingsTable).where(and(eq(spaBookingsTable.id, bookingId), eq(spaBookingsTable.restaurantId, restaurantId)));
    if (!existing) { res.status(404).json({ error: "Booking not found" }); return; }
    const prevMeta = (existing.metadata && typeof existing.metadata === "object") ? existing.metadata as Record<string, unknown> : {};
    updates.metadata = { ...prevMeta, payment: { ...(payment as Record<string, unknown>), collectedAt: new Date().toISOString() } };
    if (paymentStatus === undefined) updates.paymentStatus = "paid";
  }
  const [booking] = await db.update(spaBookingsTable).set(updates).where(and(eq(spaBookingsTable.id, bookingId), eq(spaBookingsTable.restaurantId, restaurantId))).returning();
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  // Spa money used to stop here — it never reached Finance or the Cash Counter,
  // so the owner's ledger only showed restaurant orders. Book it like any other
  // collection (de-duplicated, so re-saving the booking books it once).
  if (String(booking.paymentStatus ?? "").toLowerCase() === "paid") {
    const pay = (payment && typeof payment === "object" ? payment : {}) as Record<string, unknown>;
    await recordAncillaryPaymentInLedger({
      restaurantId,
      reference: `SPA-${booking.id}`,
      amount: booking.price,
      category: "spa_payment",
      description: `Spa · ${booking.serviceName} — ${booking.guestName}`,
      method: (pay.method as string) || "cash",
      performedBy: (pay.collectedBy as string) ?? null,
    });
  }
  res.json(booking);
});

export default router;
