import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db, spaServicesTable, spaBookingsTable, restaurantsTable } from "@workspace/db";
import {
  computeAvailableSlots, getCatalog, couplePrice, MEMBERSHIP_PLANS, THERAPISTS,
} from "../lib/spaWellnessLogic.js";

const router: IRouter = Router();

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isNaN(n) ? 0 : n;
}

router.get("/public/spa/catalog/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  const services = await db.select().from(spaServicesTable).where(
    and(eq(spaServicesTable.restaurantId, restaurantId), eq(spaServicesTable.isAvailable, true)),
  );
  const spaServices = services.filter(s => !["yoga", "gym", "meditation", "wellness"].includes(s.category));
  const wellnessServices = services.filter(s => ["yoga", "gym", "meditation", "wellness"].includes(s.category));
  res.json({
    ...getCatalog(),
    restaurantName: restaurant?.name,
    spaServices: spaServices.map(s => ({ ...s, price: parseNum(s.price) })),
    wellnessServices: wellnessServices.map(s => ({ ...s, price: parseNum(s.price) })),
    live: true,
  });
});

router.get("/public/spa/services/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const services = await db.select().from(spaServicesTable).where(
    and(eq(spaServicesTable.restaurantId, restaurantId), eq(spaServicesTable.isAvailable, true)),
  );
  res.json(services.map(s => ({ ...s, price: parseNum(s.price) })));
});

router.get("/public/spa/slots", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  const date = String(req.query.date || "");
  const duration = parseInt(String(req.query.duration || "60"), 10);
  const therapistId = req.query.therapist as string | undefined;
  if (!restaurantId || !date) { res.status(400).json({ error: "restaurantId and date required" }); return; }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const bookings = await db.select().from(spaBookingsTable).where(
    and(
      eq(spaBookingsTable.restaurantId, restaurantId),
      gte(spaBookingsTable.scheduledAt, dayStart),
      lte(spaBookingsTable.scheduledAt, dayEnd),
    ),
  );
  const active = bookings.filter(b => b.status !== "cancelled");
  const slots = computeAvailableSlots(date, duration, active, therapistId);
  res.json({ date, slots, availableCount: slots.filter(s => s.available).length });
});

router.post("/public/spa/bookings", async (req, res): Promise<void> => {
  const {
    restaurantId, serviceId, serviceName, guestName, guestPhone, guestEmail,
    scheduledAt, therapist, therapistId, notes, bookingType, partnerName,
    membershipPlanId, isWellness,
  } = req.body;
  if (!restaurantId || !guestName || !scheduledAt) { res.status(400).json({ error: "Required fields missing" }); return; }

  let price = 0;
  let duration = 60;
  let name = serviceName;
  let type = bookingType ?? (isWellness ? "wellness" : "single");

  if (type === "membership" && membershipPlanId) {
    const plan = MEMBERSHIP_PLANS.find(p => p.id === membershipPlanId);
    price = plan?.price ?? 4999;
    name = plan ? `${plan.label} Membership` : "Wellness Membership";
    duration = 0;
  } else if (serviceId) {
    const [svc] = await db.select().from(spaServicesTable).where(eq(spaServicesTable.id, serviceId));
    if (svc) {
      price = parseNum(svc.price);
      duration = svc.duration;
      name = svc.name;
      if (svc.category === "couple") type = "couple";
      if (["yoga", "gym", "meditation", "wellness"].includes(svc.category)) type = "wellness";
    }
  }

  if (type === "couple") price = couplePrice(price);

  const therapistName = therapist ?? THERAPISTS.find(t => t.id === therapistId)?.name ?? therapistId;

  const [booking] = await db.insert(spaBookingsTable).values({
    restaurantId,
    serviceId: serviceId ?? null,
    serviceName: name || "Spa Service",
    guestName,
    guestPhone,
    guestEmail,
    therapist: therapistName,
    scheduledAt: new Date(scheduledAt),
    duration,
    price: String(price.toFixed(2)),
    notes,
    status: type === "membership" ? "confirmed" : "booked",
    bookingType: type,
    paymentStatus: type === "membership" ? "paid" : "pending",
    metadata: {
      therapistId: therapistId ?? "any",
      partnerName: partnerName ?? null,
      membershipPlanId: membershipPlanId ?? null,
      isCouple: type === "couple",
      isWellness: type === "wellness",
    },
  }).returning();

  res.status(201).json({ ...booking, price: parseNum(booking.price) });
});

router.post("/public/spa/membership", async (req, res): Promise<void> => {
  const { restaurantId, guestName, guestPhone, membershipPlanId, startDate } = req.body;
  if (!restaurantId || !guestName || !membershipPlanId) {
    res.status(400).json({ error: "restaurantId, guestName, membershipPlanId required" });
    return;
  }
  const plan = MEMBERSHIP_PLANS.find(p => p.id === membershipPlanId);
  if (!plan) { res.status(400).json({ error: "Invalid membership plan" }); return; }

  const scheduledAt = startDate ? new Date(startDate) : new Date();
  const [booking] = await db.insert(spaBookingsTable).values({
    restaurantId,
    serviceName: `${plan.label} Membership`,
    guestName,
    guestPhone,
    scheduledAt,
    duration: 0,
    price: String(plan.price),
    status: "confirmed",
    bookingType: "membership",
    paymentStatus: "paid",
    metadata: { membershipPlanId, sessionsIncluded: plan.sessions, period: plan.period },
  }).returning();

  res.status(201).json({ booking, plan });
});

router.get("/public/spa/bookings", async (req, res): Promise<void> => {
  const phone = req.query.phone as string;
  const restaurantId = parseInt(String(req.query.restaurantId || "0"), 10);
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  const list = await db.select().from(spaBookingsTable).where(
    and(eq(spaBookingsTable.restaurantId, restaurantId), eq(spaBookingsTable.guestPhone, phone)),
  ).orderBy(desc(spaBookingsTable.createdAt));
  res.json(list.map(b => ({ ...b, price: parseNum(b.price) })));
});

router.patch("/public/spa/bookings/:id/cancel", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [booking] = await db.update(spaBookingsTable).set({ status: "cancelled" }).where(eq(spaBookingsTable.id, id)).returning();
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(booking);
});

export default router;
