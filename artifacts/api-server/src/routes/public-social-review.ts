import { Router, type IRouter } from "express";
import { getPublicBaseUrl } from "../lib/scan-urls.js";
import { eq, and, desc, gte, inArray, isNotNull } from "drizzle-orm";
import { db, restaurantsTable, feedbackTable, guestUsersTable, ordersTable, guestSessionsTable } from "@workspace/db";
import {
  getSocialReviewCatalog, mapFeedbackRow, computeRatingStats,
  getReviewsForRestaurant, createFoodPhoto, likePhotoInList, buildSharePayload,
  getOrCreateReferralCode, trackReferralShare, buildReferralLink,
  type SocialGuestData, type FoodPhotoRecord,
} from "../lib/socialReviewLogic.js";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings.js";

const router: IRouter = Router();

async function loadRestaurant(slugOrId: string) {
  const id = parseInt(slugOrId, 10);
  if (!Number.isNaN(id)) {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    return r ?? null;
  }
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slugOrId));
  return r ?? null;
}

function guestKey(req: { session?: { guestUserId?: number }; ip?: string }) {
  return String(req.session?.guestUserId ?? req.ip ?? "guest");
}

router.get("/public/social/catalog", (_req, res) => {
  res.json(getSocialReviewCatalog());
});

router.get("/public/social/ratings/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  let dbReviews: ReturnType<typeof mapFeedbackRow>[] = [];
  if (restaurant) {
    const rows = await db.select().from(feedbackTable)
      .where(eq(feedbackTable.restaurantId, restaurant.id))
      .orderBy(desc(feedbackTable.createdAt));
    dbReviews = rows.map(mapFeedbackRow);
  }
  const reviews = getReviewsForRestaurant(restaurant?.id ?? 0, dbReviews);
  const stats = computeRatingStats(reviews);
  res.json({
    stats,
    restaurantName: restaurant?.name ?? "Venue",
    categories: [
      { id: "overall", label: "Overall", score: stats.average },
      { id: "food", label: "Food", score: stats.food },
      { id: "service", label: "Service", score: stats.service },
      { id: "ambience", label: "Ambience", score: stats.ambience },
    ],
  });
});

router.get("/public/social/reviews/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  let dbReviews: ReturnType<typeof mapFeedbackRow>[] = [];
  if (restaurant) {
    const rows = await db.select().from(feedbackTable)
      .where(eq(feedbackTable.restaurantId, restaurant.id))
      .orderBy(desc(feedbackTable.createdAt));
    dbReviews = rows.map(mapFeedbackRow);
  }
  const reviews = getReviewsForRestaurant(restaurant?.id ?? 0, dbReviews);
  const stats = computeRatingStats(reviews);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  res.json({ reviews, stats, restaurantName: restaurant.name });
});

/**
 * Which orders at this venue the caller can be shown to have placed.
 *
 * Reviews were open to anyone with the venue's numeric id: no session, no order, no
 * limit. One unauthenticated POST moved venue 1's public average from 3.83 to 3.43, and
 * a loop would have taken it to one star in seconds. A review has to come from someone
 * who actually ate there.
 *
 * A signed-in guest is matched on the phone or email recorded against the order; an
 * anonymous diner on the table their browser session was opened at. Both are the same
 * tests the order and invoice routes already use.
 */
async function ordersCallerPlaced(req: Parameters<typeof loadRestaurant> extends never ? never : import("express").Request, restaurantId: number) {
  const rows: (typeof ordersTable.$inferSelect)[] = [];

  const guestUserId = req.session.guestUserId;
  if (guestUserId) {
    const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId)).limit(1);
    const identities = [guest?.phone, guest?.email].filter((v): v is string => Boolean(v));
    if (identities.length) {
      const byPhone = guest?.phone
        ? await db.select().from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.customerPhone, guest.phone)))
        : [];
      const byEmail = guest?.email
        ? await db.select().from(ordersTable).where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.customerEmail, guest.email)))
        : [];
      rows.push(...byPhone, ...byEmail);
    }
  }

  const sessionId = req.session.guestSessionId;
  if (sessionId) {
    const [gs] = await db.select().from(guestSessionsTable).where(eq(guestSessionsTable.id, sessionId)).limit(1);
    if (gs && gs.restaurantId === restaurantId && gs.tableId != null) {
      const byTable = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.restaurantId, restaurantId), eq(ordersTable.tableId, gs.tableId)));
      rows.push(...byTable);
    }
  }

  const seen = new Set<number>();
  return rows.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

/** At most this many reviews from one browser session in an hour. */
const REVIEW_RATE_LIMIT = 3;
const REVIEW_RATE_WINDOW_MS = 60 * 60 * 1000;
const reviewRate = new Map<string, number[]>();

function reviewRateExceeded(key: string): boolean {
  const now = Date.now();
  const recent = (reviewRate.get(key) ?? []).filter(t => now - t < REVIEW_RATE_WINDOW_MS);
  if (recent.length >= REVIEW_RATE_LIMIT) { reviewRate.set(key, recent); return true; }
  recent.push(now);
  reviewRate.set(key, recent);
  return false;
}

router.post("/public/social/reviews", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const rating = parseInt(String(req.body.rating ?? req.body.overall ?? 0), 10);
  // A signed-in diner's review used to be published as "Guest" whenever the page did not
  // repeat their name in the body, so nobody could tell their own review from anyone
  // else's. Fall back to the account they are signed in with before giving up.
  const signedInName = req.session.guestUserId
    ? (await db.select({ name: guestUsersTable.name }).from(guestUsersTable)
        .where(eq(guestUsersTable.id, req.session.guestUserId)).limit(1))[0]?.name
    : null;
  const customerName = String(
    req.body.customerName ?? req.body.reviewer ?? req.body.name ?? signedInName ?? "Guest",
  );
  const comment = String(req.body.comment ?? req.body.text ?? "");
  const foodRating = parseInt(String(req.body.foodRating ?? req.body.food ?? rating), 10);
  const serviceRating = parseInt(String(req.body.serviceRating ?? req.body.service ?? rating), 10);
  const ambienceRating = parseInt(String(req.body.ambienceRating ?? req.body.ambience ?? rating), 10);

  if (!restaurantId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "restaurantId and rating (1-5) required" });
    return;
  }

  if (reviewRateExceeded(guestKey(req))) {
    res.status(429).json({ error: "You have left several reviews already. Please try again later." });
    return;
  }

  // Only a diner who ate here may rate the place.
  const placed = await ordersCallerPlaced(req, restaurantId);
  if (!placed.length) {
    res.status(403).json({
      error: "Only guests who have ordered here can leave a review. Scan your table's QR code, or sign in with the number you ordered with.",
    });
    return;
  }

  // One order, one review — otherwise the same meal can be rated as many times as the
  // guest cares to press the button.
  const requestedOrderId = req.body.orderId ? parseInt(String(req.body.orderId), 10) : NaN;
  const order = Number.isInteger(requestedOrderId)
    ? placed.find(o => o.id === requestedOrderId)
    : placed.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
  if (!order) {
    res.status(403).json({ error: "That order is not one of yours." });
    return;
  }

  const [already] = await db.select({ id: feedbackTable.id }).from(feedbackTable)
    .where(eq(feedbackTable.orderId, order.id)).limit(1);
  if (already) {
    res.status(409).json({ error: "You have already reviewed this order. Thank you." });
    return;
  }

  const [fb] = await db.insert(feedbackTable).values({
    restaurantId, customerName, rating, foodRating, serviceRating, ambienceRating, comment,
    orderId: order.id,
  }).returning();

  const review = mapFeedbackRow(fb);
  res.status(201).json({ ...review, message: "Review submitted — thank you!" });
});

router.get("/public/social/food-photos/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const social = await getSettingsSection<SocialGuestData>(restaurant.id, "guestSocial", { photos: [] });
  res.json({ photos: social.photos ?? [], restaurantName: restaurant.name });
});

router.post("/public/social/food-photos", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const result = createFoodPhoto({
    imageData: String(req.body.imageData ?? ""),
    caption: String(req.body.caption ?? ""),
    uploader: String(req.body.uploader ?? "Guest"),
    reviewId: req.body.reviewId,
  });
  if ("error" in result) { res.status(400).json(result); return; }
  const social = await getSettingsSection<SocialGuestData>(restaurantId, "guestSocial", { photos: [] });
  const photos = [result, ...(social.photos ?? [])].slice(0, 100);
  await setSettingsSection(restaurantId, "guestSocial", { ...social, photos });
  res.status(201).json({ ...result, message: "Photo uploaded!" });
});

router.post("/public/social/food-photos/:photoId/like", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const social = await getSettingsSection<SocialGuestData>(restaurantId, "guestSocial", { photos: [] });
  const photos = [...(social.photos ?? [])];
  const photo = likePhotoInList(photos, req.params.photoId);
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }
  await setSettingsSection(restaurantId, "guestSocial", { ...social, photos });
  res.json(photo);
});

router.post("/public/social/share", async (req, res): Promise<void> => {
  const slug = String(req.body.slug ?? "spice-garden");
  const restaurant = await loadRestaurant(slug);
  // This defaulted to a domain that no longer resolves, so a share link a guest posted
  // to Instagram led nowhere. Use the deployment's own address.
  const baseUrl = String(req.body.baseUrl ?? getPublicBaseUrl());
  const shareUrl = `${baseUrl}/user/menu?slug=${slug}${req.body.table ? `&table=${req.body.table}` : ""}`;
  const payload = buildSharePayload({
    platform: String(req.body.platform ?? "whatsapp"),
    template: String(req.body.template ?? "restaurant"),
    restaurantName: restaurant?.name ?? "Venue",
    shareUrl,
    dishName: req.body.dishName ? String(req.body.dishName) : undefined,
    rating: req.body.rating ? parseInt(String(req.body.rating), 10) : undefined,
    reviewText: req.body.reviewText ? String(req.body.reviewText) : undefined,
  });
  res.json(payload);
});

router.get("/public/social/referral/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) { res.status(404).json({ error: "Venue not found" }); return; }
  const social = await getSettingsSection<SocialGuestData>(restaurant.id, "guestSocial", { referralCodes: {} });
  const { ref } = getOrCreateReferralCode(guestKey(req), restaurant.id, social.referralCodes ?? {});
  await setSettingsSection(restaurant.id, "guestSocial", { ...social, referralCodes: { ...(social.referralCodes ?? {}), [`${guestKey(req)}:${restaurant.id}`]: ref } });
  const baseUrl = String(req.query.baseUrl ?? "");
  const link = baseUrl
    ? buildReferralLink(baseUrl, ref.code, req.params.slug)
    : `/user/menu?slug=${req.params.slug}&ref=${ref.code}`;
  res.json({
    code: ref.code,
    link,
    shares: ref.shares,
    signups: ref.signups,
    reward: "₹100 wallet credit",
    friendReward: "10% off first order",
    restaurantName: restaurant.name,
  });
});

router.post("/public/social/referral/share", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const slug = String(req.body.slug ?? "spice-garden");
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }
  const social = await getSettingsSection<SocialGuestData>(restaurantId, "guestSocial", { referralCodes: {} });
  const ref = trackReferralShare(guestKey(req), restaurantId, social.referralCodes ?? {});
  await setSettingsSection(restaurantId, "guestSocial", { ...social, referralCodes: { ...(social.referralCodes ?? {}), [`${guestKey(req)}:${restaurantId}`]: ref } });
  const baseUrl = String(req.body.baseUrl ?? "");
  const link = baseUrl
    ? buildReferralLink(baseUrl, ref.code, slug)
    : `/user/menu?slug=${slug}&ref=${ref.code}`;
  res.json({ ...ref, link, message: "Referral link ready to share!" });
});

export default router;
