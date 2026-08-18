import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, or, sql } from "drizzle-orm";
import {
  db, guestUsersTable, customersTable, loyaltyProgramsTable, loyaltyTransactionsTable,
} from "@workspace/db";
import {
  getLoyaltyCatalog, buildMemberSummary, normalizeRewardsMeta,
  applyPointsRedeem, applyBirthdayClaim, applyAnniversaryClaim, tierFromPoints,
} from "../lib/loyaltyMembershipLogic.js";

const router: IRouter = Router();

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

async function loadCustomer(restaurantId: number, guest: typeof guestUsersTable.$inferSelect) {
  if (!guest.phone && !guest.email) return null;
  const [customer] = await db.select().from(customersTable).where(and(
    eq(customersTable.restaurantId, restaurantId),
    or(
      guest.phone ? eq(customersTable.phone, guest.phone) : sql`false`,
      guest.email ? eq(customersTable.email, guest.email) : sql`false`,
    ),
  ));
  return customer ?? null;
}

router.get("/public/loyalty/catalog", (_req, res) => {
  res.json(getLoyaltyCatalog());
});

router.get("/public/me/loyalty", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const restaurantId = req.session.restaurantId ?? parseInt(String(req.query.restaurantId || "0"), 10);
  let program = null;
  let customer = null;
  let transactions: unknown[] = [];

  if (restaurantId) {
    [program] = await db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.restaurantId, restaurantId));
    customer = await loadCustomer(restaurantId, guest);
    if (customer) {
      transactions = await db.select().from(loyaltyTransactionsTable).where(
        and(eq(loyaltyTransactionsTable.restaurantId, restaurantId), eq(loyaltyTransactionsTable.customerId, customer.id)),
      ).orderBy(desc(loyaltyTransactionsTable.createdAt)).limit(30);
    }
  }

  const summary = buildMemberSummary(guest, customer, program ?? undefined);
  res.json({ ...summary, program, transactions, tiers: getLoyaltyCatalog().tiers });
});

router.get("/public/me/loyalty/rewards", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }
  const restaurantId = req.session.restaurantId ?? parseInt(String(req.query.restaurantId || "0"), 10);
  const customer = restaurantId ? await loadCustomer(restaurantId, guest) : null;
  const summary = buildMemberSummary(guest, customer);
  res.json({ rewards: summary.rewards, tier: summary.tier, points: summary.points });
});

router.post("/public/me/loyalty/redeem-points", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const redeemPoints = parseInt(String(req.body.points ?? 0), 10);
  const currentPoints = parseInt(guest.loyaltyPoints || "0", 10);
  const rewardsMeta = normalizeRewardsMeta(guest.rewardsMeta);
  const result = applyPointsRedeem(currentPoints, redeemPoints, rewardsMeta);
  if (!result) { res.status(400).json({ error: "Invalid redeem amount" }); return; }

  await db.update(guestUsersTable).set({
    loyaltyPoints: String(result.newPoints),
    rewardsMeta: result.newRewardsMeta,
  }).where(eq(guestUsersTable.id, guest.id));

  res.json({
    success: true,
    points: result.newPoints,
    diningCreditsAdded: result.creditAdded,
    diningCredits: result.newRewardsMeta.diningCredits,
  });
});

router.post("/public/me/loyalty/claim-birthday", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const summary = buildMemberSummary(guest);
  if (!summary.rewards.birthday.eligible) {
    res.status(400).json({ error: "Birthday reward not available — set birthday or wait until birthday month" });
    return;
  }

  const year = new Date().getFullYear();
  const rewardsMeta = applyBirthdayClaim(normalizeRewardsMeta(guest.rewardsMeta), year);
  await db.update(guestUsersTable).set({ rewardsMeta }).where(eq(guestUsersTable.id, guest.id));

  res.json({ success: true, reward: summary.rewards.birthday.value, diningCredits: rewardsMeta.diningCredits });
});

router.post("/public/me/loyalty/claim-anniversary", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const summary = buildMemberSummary(guest);
  if (!summary.rewards.anniversary.eligible) {
    res.status(400).json({ error: "Anniversary reward not available — set anniversary or wait until anniversary month" });
    return;
  }

  const year = new Date().getFullYear();
  const rewardsMeta = applyAnniversaryClaim(normalizeRewardsMeta(guest.rewardsMeta), year);
  await db.update(guestUsersTable).set({ rewardsMeta }).where(eq(guestUsersTable.id, guest.id));

  res.json({ success: true, reward: summary.rewards.anniversary.value, diningCredits: rewardsMeta.diningCredits });
});

router.patch("/public/me/loyalty/profile", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const patch: Record<string, string> = {};
  if (req.body.birthday) patch.birthday = String(req.body.birthday);
  if (req.body.anniversary) patch.anniversary = String(req.body.anniversary);
  if (!Object.keys(patch).length) { res.status(400).json({ error: "birthday or anniversary required" }); return; }

  const [updated] = await db.update(guestUsersTable).set(patch).where(eq(guestUsersTable.id, guest.id)).returning();
  const summary = buildMemberSummary(updated);
  res.json({ success: true, ...summary });
});

export default router;
