import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, qrCodesTable, restaurantsTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/qrcodes", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const codes = await db.select().from(qrCodesTable).where(eq(qrCodesTable.restaurantId, restaurantId));
  res.json(codes);
});

router.post("/restaurants/:restaurantId/qrcodes", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { label, type, tableId } = req.body;
  const [restaurant] = await db.select({ slug: restaurantsTable.slug }).from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  const baseUrl = process.env.PUBLIC_URL ?? "https://digitalrestuarants.thefingo.com";
  const url = `${baseUrl}/menu/${restaurant.slug}${tableId ? `?table=${tableId}` : ""}`;
  const [code] = await db.insert(qrCodesTable).values({ restaurantId, tableId: tableId ?? null, label, type: type ?? "table", url }).returning();
  res.status(201).json(code);
});

router.delete("/restaurants/:restaurantId/qrcodes/:qrCodeId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const qrCodeId = parseInt(req.params.qrCodeId, 10);
  const [deleted] = await db.delete(qrCodesTable).where(and(eq(qrCodesTable.id, qrCodeId), eq(qrCodesTable.restaurantId, restaurantId))).returning();
  if (!deleted) { res.status(404).json({ error: "QR code not found" }); return; }
  res.json({ message: "QR code deleted" });
});

export default router;
