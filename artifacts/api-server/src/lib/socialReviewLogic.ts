export type ReviewRecord = {
  id: string | number;
  reviewer: string;
  rating: number;
  foodRating?: number;
  serviceRating?: number;
  ambienceRating?: number;
  text: string;
  date: string;
  source: string;
  hasPhoto?: boolean;
  imageUrls?: string[];
};

export type FoodPhotoRecord = {
  id: string;
  url: string;
  caption: string;
  uploader: string;
  likes: number;
  reviewId?: string | number | null;
  createdAt: string;
};

export type SocialGuestData = {
  photos?: FoodPhotoRecord[];
  referralCodes?: Record<string, { code: string; shares: number; signups: number; restaurantId: number }>;
};

export function mergeSocialPhotos(stored: FoodPhotoRecord[], memory: FoodPhotoRecord[]): FoodPhotoRecord[] {
  const seen = new Set<string>();
  return [...stored, ...memory].filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getSocialReviewCatalog() {
  return {
    features: ["ratings", "reviews", "food_image_uploads", "social_sharing", "referral_sharing"],
    ratingCategories: ["overall", "food", "service", "ambience"],
    sharePlatforms: ["whatsapp", "facebook", "twitter", "instagram", "copy", "native"],
    referralReward: "₹100 wallet credit",
  };
}

export function mapFeedbackRow(f: {
  id: number; customerName: string | null; rating: number;
  foodRating: number | null; serviceRating: number | null;
  ambienceRating: number | null; comment: string | null; createdAt: Date;
}): ReviewRecord {
  return {
    id: f.id,
    reviewer: f.customerName ?? "Guest",
    rating: f.rating,
    foodRating: f.foodRating ?? undefined,
    serviceRating: f.serviceRating ?? undefined,
    ambienceRating: f.ambienceRating ?? undefined,
    text: f.comment ?? "",
    date: f.createdAt.toISOString(),
    source: "guest",
    hasPhoto: false,
  };
}

export function computeRatingStats(reviews: ReviewRecord[]) {
  if (!reviews.length) {
    return { average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, food: 0, service: 0, ambience: 0 };
  }
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let foodSum = 0, foodCount = 0, serviceSum = 0, serviceCount = 0, ambSum = 0, ambCount = 0;
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    breakdown[star as 1 | 2 | 3 | 4 | 5] += 1;
    if (r.foodRating) { foodSum += r.foodRating; foodCount++; }
    if (r.serviceRating) { serviceSum += r.serviceRating; serviceCount++; }
    if (r.ambienceRating) { ambSum += r.ambienceRating; ambCount++; }
  }
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return {
    average: Math.round(avg * 10) / 10,
    total: reviews.length,
    breakdown,
    food: foodCount ? Math.round((foodSum / foodCount) * 10) / 10 : avg,
    service: serviceCount ? Math.round((serviceSum / serviceCount) * 10) / 10 : avg,
    ambience: ambCount ? Math.round((ambSum / ambCount) * 10) / 10 : avg,
  };
}

export function getReviewsForRestaurant(_restaurantId: number, dbReviews: ReviewRecord[] = []) {
  return [...dbReviews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function createFoodPhoto(
  data: { imageData: string; caption: string; uploader: string; reviewId?: string | number },
  id?: string,
): FoodPhotoRecord | { error: string } {
  if (!data.imageData || data.imageData.length > 2_000_000) {
    return { error: "Image too large (max ~1.5MB)" };
  }
  return {
    id: id ?? `up-${Date.now()}`,
    url: data.imageData.startsWith("data:") ? data.imageData : `data:image/jpeg;base64,${data.imageData}`,
    caption: data.caption || "Food photo",
    uploader: data.uploader || "Guest",
    likes: 0,
    reviewId: data.reviewId ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function likePhotoInList(photos: FoodPhotoRecord[], photoId: string): FoodPhotoRecord | null {
  const idx = photos.findIndex(p => p.id === photoId);
  if (idx < 0) return null;
  photos[idx] = { ...photos[idx], likes: photos[idx].likes + 1 };
  return photos[idx];
}

export function buildSharePayload(opts: {
  platform: string;
  template: string;
  restaurantName: string;
  shareUrl: string;
  dishName?: string;
  rating?: number;
  reviewText?: string;
}) {
  const { platform, template, restaurantName, shareUrl, dishName, rating, reviewText } = opts;
  let message = "";
  switch (template) {
    case "dish":
      message = `🍛 Check out ${dishName ?? "this dish"} at ${restaurantName}! ${shareUrl}`;
      break;
    case "review":
      message = `⭐ I rated ${restaurantName} ${rating ?? 5}/5! "${reviewText?.slice(0, 80) ?? "Amazing experience"}" ${shareUrl}`;
      break;
    case "offer":
      message = `🎉 Great offers at ${restaurantName}! Order now: ${shareUrl}`;
      break;
    default:
      message = `🏪 I loved dining at ${restaurantName}! Check them out: ${shareUrl}`;
  }

  const encoded = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(shareUrl);
  const links: Record<string, string | null> = {
    whatsapp: `https://wa.me/?text=${encoded}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
    twitter: `https://twitter.com/intent/tweet?text=${encoded}`,
    instagram: null,
    copy: shareUrl,
    native: shareUrl,
  };
  return { message, url: links[platform] ?? shareUrl, platform };
}

export function getOrCreateReferralCode(
  guestKey: string,
  restaurantId: number,
  stored: Record<string, { code: string; shares: number; signups: number; restaurantId: number }> = {},
  prefix = "SPICE",
) {
  const key = `${guestKey}:${restaurantId}`;
  if (!stored[key]) {
    const suffix = guestKey.replace(/\D/g, "").slice(-4) || String(Math.floor(Math.random() * 9000) + 1000);
    stored[key] = { code: `${prefix}${suffix}`, shares: 0, signups: 0, restaurantId };
  }
  return { ref: stored[key], stored, key };
}

export function trackReferralShare(
  guestKey: string,
  restaurantId: number,
  stored: Record<string, { code: string; shares: number; signups: number; restaurantId: number }> = {},
) {
  const { ref, stored: next, key } = getOrCreateReferralCode(guestKey, restaurantId, stored);
  next[key] = { ...ref, shares: ref.shares + 1 };
  return next[key];
}

export function buildReferralLink(baseUrl: string, code: string, slug: string) {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}/user/menu?slug=${slug}${sep}ref=${code}`;
}

export function sentimentFromRating(rating: number) {
  if (rating >= 4) return "positive";
  if (rating >= 3) return "neutral";
  return "negative";
}
