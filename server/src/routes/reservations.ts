import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, reservationsTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/reservations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { status, date } = req.query;
  let reservations = await db.select().from(reservationsTable).where(eq(reservationsTable.restaurantId, id));
  if (status) reservations = reservations.filter(r => r.status === status);
  if (date) reservations = reservations.filter(r => r.date === date);
  res.json(reservations);
});

router.put("/restaurants/:restaurantId/reservations/:reservationId", requireAuth, async (req, res): Promise<void> => {
  const reservationId = parseInt(req.params.reservationId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, tableId } = req.body;
  const [reservation] = await db.update(reservationsTable).set({ status, tableId }).where(and(eq(reservationsTable.id, reservationId), eq(reservationsTable.restaurantId, restaurantId))).returning();
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }
  res.json(reservation);
});

export default router;
