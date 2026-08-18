import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, loyaltyProgramsTable, loyaltyTransactionsTable, customersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/loyalty", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  let [program] = await db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.restaurantId, id));
  if (!program) {
    [program] = await db.insert(loyaltyProgramsTable).values({ restaurantId: id }).returning();
  }
  res.json(program);
});

router.put("/restaurants/:restaurantId/loyalty", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { isEnabled, type, pointsPerDollar, cashbackPercent, stampsForReward, rewardValue, expiryDays } = req.body;
  let [existing] = await db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.restaurantId, id));
  if (!existing) {
    [existing] = await db.insert(loyaltyProgramsTable).values({ restaurantId: id, isEnabled, type, pointsPerDollar, cashbackPercent, stampsForReward, rewardValue, expiryDays }).returning();
  } else {
    [existing] = await db.update(loyaltyProgramsTable).set({ isEnabled, type, pointsPerDollar, cashbackPercent, stampsForReward, rewardValue, expiryDays }).where(eq(loyaltyProgramsTable.restaurantId, id)).returning();
  }
  res.json(existing);
});

router.get("/restaurants/:restaurantId/loyalty/transactions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const transactions = await db.select().from(loyaltyTransactionsTable).where(eq(loyaltyTransactionsTable.restaurantId, id)).orderBy(desc(loyaltyTransactionsTable.createdAt)).limit(100);
  const result = await Promise.all(transactions.map(async (t) => {
    const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, t.customerId));
    return { ...t, customerName: cust?.name ?? null };
  }));
  res.json(result);
});

router.get("/restaurants/:restaurantId/gift-cards", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const stored = await getSettingsSection(id, "giftCards", { cards: [] });
  res.json(Array.isArray(stored.cards) ? stored.cards : []);
});

export default router;
