import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, promoCodesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/promo-codes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
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
  const id = parseInt(req.params.restaurantId, 10);
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

export default router;
