import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/customers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, id))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { search, segment } = req.query;
  let customers = await db.select().from(customersTable).where(eq(customersTable.restaurantId, id));
  if (segment) customers = customers.filter(c => c.segment === segment);
  if (search) {
    const s = String(search).toLowerCase();
    customers = customers.filter(c => c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s));
  }
  res.json(customers.map(c => ({ ...c, lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null })));
});

router.post("/restaurants/:restaurantId/customers", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { name, email, phone, segment, notes, birthday, anniversary } = req.body;
  if (!name && !phone && !email) { res.status(400).json({ error: "name, phone or email required" }); return; }
  const [customer] = await db.insert(customersTable).values({
    restaurantId,
    name: name ?? null,
    email: email ?? null,
    phone: phone ?? null,
    segment: segment ?? "new",
    notes: notes ?? null,
    birthday: birthday ?? null,
    anniversary: anniversary ?? null,
  }).returning();
  res.status(201).json({ ...customer, lastVisit: customer.lastVisit ? customer.lastVisit.toISOString() : null });
});

router.get("/restaurants/:restaurantId/customers/:customerId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const customerId = parseInt(req.params.customerId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.restaurantId, restaurantId)));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ ...customer, lastVisit: customer.lastVisit ? customer.lastVisit.toISOString() : null });
});

router.put("/restaurants/:restaurantId/customers/:customerId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const customerId = parseInt(req.params.customerId, 10);
  if (!(await getAccessibleRestaurant(req, restaurantId))) { res.status(404).json({ error: "Restaurant not found" }); return; }
  const { name, email, phone, segment, notes, birthday, anniversary, isVip, loyaltyPoints } = req.body;
  const [customer] = await db.update(customersTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
    ...(segment !== undefined && { segment }),
    ...(notes !== undefined && { notes }),
    ...(birthday !== undefined && { birthday }),
    ...(anniversary !== undefined && { anniversary }),
    ...(isVip !== undefined && { isVip }),
    ...(loyaltyPoints !== undefined && { loyaltyPoints }),
  }).where(and(eq(customersTable.id, customerId), eq(customersTable.restaurantId, restaurantId))).returning();
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ ...customer, lastVisit: customer.lastVisit ? customer.lastVisit.toISOString() : null });
});

export default router;
