import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, restaurantsTable, feedbackTable } from "@workspace/db";
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

router.post("/public/social/reviews", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const rating = parseInt(String(req.body.rating ?? req.body.overall ?? 0), 10);
  const customerName = String(req.body.customerName ?? req.body.reviewer ?? "Guest");
  const comment = String(req.body.comment ?? req.body.text ?? "");
  const foodRating = parseInt(String(req.body.foodRating ?? req.body.food ?? rating), 10);
  const serviceRating = parseInt(String(req.body.serviceRating ?? req.body.service ?? rating), 10);
  const ambienceRating = parseInt(String(req.body.ambienceRating ?? req.body.ambience ?? rating), 10);

  if (!restaurantId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "restaurantId and rating (1-5) required" });
    return;
  }

  const [fb] = await db.insert(feedbackTable).values({
    restaurantId, customerName, rating, foodRating, serviceRating, ambienceRating, comment,
    orderId: req.body.orderId ? parseInt(String(req.body.orderId), 10) : undefined,
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
  const baseUrl = String(req.body.baseUrl ?? "https://digitalrestuarants.thefingo.com");
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
