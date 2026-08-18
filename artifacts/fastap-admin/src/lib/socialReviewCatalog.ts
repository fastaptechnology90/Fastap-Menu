/** Social & Review System — catalog & demo data */

export type SocialFeatureId =
  | "ratings"
  | "reviews"
  | "food_image_uploads"
  | "social_sharing"
  | "referral_sharing";

export const SOCIAL_FEATURES = [
  { id: "ratings" as const, label: "Ratings", icon: "⭐", desc: "Rate food, service & ambience with star breakdown" },
  { id: "reviews" as const, label: "Reviews", icon: "💬", desc: "Read guest reviews & write your own experience" },
  { id: "food_image_uploads" as const, label: "Food Photos", icon: "📸", desc: "Upload & browse food photos from guests" },
  { id: "social_sharing" as const, label: "Social Sharing", icon: "🔗", desc: "Share restaurant & dishes on WhatsApp, X & more" },
  { id: "referral_sharing" as const, label: "Referral Sharing", icon: "🎁", desc: "Invite friends — earn rewards when they order" },
];

export const RATING_CATEGORIES = [
  { id: "overall", label: "Overall", icon: "⭐" },
  { id: "food", label: "Food", icon: "🍽️" },
  { id: "service", label: "Service", icon: "🛎️" },
  { id: "ambience", label: "Ambience", icon: "✨" },
];

export const DEMO_REVIEWS = [
  { id: "r1", reviewer: "Rahul Sharma", rating: 5, foodRating: 5, serviceRating: 5, ambienceRating: 4, text: "Butter chicken was incredible! Best I've had in Mumbai.", date: new Date(Date.now() - 86400000).toISOString(), source: "guest", hasPhoto: true },
  { id: "r2", reviewer: "Priya Singh", rating: 4, foodRating: 4, serviceRating: 5, ambienceRating: 4, text: "Lovely ambiance and attentive staff. Paneer tikka was perfect.", date: new Date(Date.now() - 2 * 86400000).toISOString(), source: "guest", hasPhoto: false },
  { id: "r3", reviewer: "Amit Kumar", rating: 5, foodRating: 5, serviceRating: 4, ambienceRating: 5, text: "Celebrated birthday here — they surprised us with a complimentary dessert!", date: new Date(Date.now() - 3 * 86400000).toISOString(), source: "guest", hasPhoto: true },
  { id: "r4", reviewer: "Sneha Patel", rating: 3, foodRating: 3, serviceRating: 4, ambienceRating: 3, text: "Food was good but wait time was longer than expected.", date: new Date(Date.now() - 5 * 86400000).toISOString(), source: "google", hasPhoto: false },
];

export const DEMO_FOOD_PHOTOS = [
  { id: "p1", url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80", caption: "Butter Chicken", uploader: "Rahul S.", likes: 24, reviewId: "r1" },
  { id: "p2", url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80", caption: "Paneer Tikka", uploader: "Priya S.", likes: 18, reviewId: "r2" },
  { id: "p3", url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80", caption: "Birthday Platter", uploader: "Amit K.", likes: 31, reviewId: "r3" },
  { id: "p4", url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80", caption: "Restaurant Ambience", uploader: "Guest", likes: 12, reviewId: null },
];

export const SOCIAL_PLATFORMS = [
  { id: "whatsapp", label: "WhatsApp", icon: "💬", color: "#25D366" },
  { id: "facebook", label: "Facebook", icon: "📘", color: "#1877F2" },
  { id: "twitter", label: "X (Twitter)", icon: "🐦", color: "#1DA1F2" },
  { id: "instagram", label: "Instagram", icon: "📷", color: "#E4405F" },
  { id: "copy", label: "Copy Link", icon: "🔗", color: "#64748b" },
  { id: "native", label: "Share Sheet", icon: "📤", color: "#7c3aed" },
];

export const SHARE_TEMPLATES = [
  { id: "restaurant", label: "Share Restaurant", emoji: "🏪" },
  { id: "dish", label: "Share a Dish", emoji: "🍛" },
  { id: "review", label: "Share My Review", emoji: "⭐" },
  { id: "offer", label: "Share Offer", emoji: "🎉" },
];

export const REFERRAL_CONFIG = {
  rewardLabel: "₹100 wallet credit",
  friendRewardLabel: "10% off first order",
  minOrderForReward: 299,
  codePrefix: "SPICE",
};

export type GuestReview = typeof DEMO_REVIEWS[number];
export type FoodPhoto = typeof DEMO_FOOD_PHOTOS[number];

export type RatingSubmission = {
  overall: number;
  food: number;
  service: number;
  ambience: number;
  comment?: string;
};
