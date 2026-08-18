import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/customers", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { search, segment } = req.query;
  let customers = await db.select().from(customersTable).where(eq(customersTable.restaurantId, id));
  if (segment) customers = customers.filter(c => c.segment === segment);
  if (search) {
    const s = String(search).toLowerCase();
    customers = customers.filter(c => c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s));
  }
  res.json(customers.map(c => ({ ...c, lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null })));
});

router.get("/restaurants/:restaurantId/customers/:customerId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const customerId = parseInt(req.params.customerId, 10);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer || customer.restaurantId !== restaurantId) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ ...customer, lastVisit: customer.lastVisit ? customer.lastVisit.toISOString() : null });
});

export default router;
