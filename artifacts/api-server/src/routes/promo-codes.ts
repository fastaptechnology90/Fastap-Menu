import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, promoCodesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/promo-codes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const rows = await db.select().from(promoCodesTable).where(eq(promoCodesTable.restaurantId, id));
  res.json(rows.map(p => ({
    ...p,
    discountValue: parseFloat(String(p.discountValue ?? 0)),
    minOrderAmount: parseFloat(String(p.minOrderAmount ?? 0)),
    maxDiscount: p.maxDiscount ? parseFloat(String(p.maxDiscount)) : null,
    status: p.isActive ? (p.expiresAt && new Date(p.expiresAt) < new Date() ? "expired" : "active") : "inactive",
  })));
});

router.post("/restaurants/:restaurantId/promo-codes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt } = req.body;
  const [row] = await db.insert(promoCodesTable).values({
    restaurantId: id,
    code: String(code).toUpperCase(),
    discountType: discountType || "percent",
    discountValue: String(discountValue ?? 0),
    minOrderAmount: String(minOrderAmount ?? 0),
    maxDiscount: maxDiscount != null ? String(maxDiscount) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: true,
  }).returning();
  res.status(201).json(row);
});

/**
 * A coupon could be created and never touched again — there was no update and no delete,
 * so a wrong discount, a wrong expiry or a code that had to be pulled could only be
 * fixed in the database. Deactivating (`isActive: false`) is the usual way to retire one,
 * since deleting loses the record of what was offered.
 */
router.put("/restaurants/:restaurantId/promo-codes/:promoId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const promoId = parseInt(String(req.params.promoId), 10);
  const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, isActive, usageLimit } = req.body;

  const [row] = await db.update(promoCodesTable).set({
    ...(code !== undefined && { code: String(code).toUpperCase() }),
    ...(discountType !== undefined && { discountType }),
    ...(discountValue !== undefined && { discountValue: String(discountValue) }),
    ...(minOrderAmount !== undefined && { minOrderAmount: String(minOrderAmount) }),
    ...(maxDiscount !== undefined && { maxDiscount: maxDiscount != null ? String(maxDiscount) : null }),
    ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    ...(usageLimit !== undefined && { usageLimit: usageLimit != null ? Number(usageLimit) : null }),
  }).where(and(eq(promoCodesTable.id, promoId), eq(promoCodesTable.restaurantId, restaurantId))).returning();

  if (!row) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json(row);
});

router.delete("/restaurants/:restaurantId/promo-codes/:promoId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const promoId = parseInt(String(req.params.promoId), 10);
  const [row] = await db.delete(promoCodesTable)
    .where(and(eq(promoCodesTable.id, promoId), eq(promoCodesTable.restaurantId, restaurantId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json({ success: true });
});

export default router;
