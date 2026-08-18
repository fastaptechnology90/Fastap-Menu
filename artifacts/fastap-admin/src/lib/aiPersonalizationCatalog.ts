/** AI Personalization Engine — catalog & demo data */
export type AiFeatureId =
  | "personalized_menu"
  | "favorite_prediction"
  | "combo_recommendations"
  | "ai_upselling"
  | "dietary_suggestions"
  | "spending_analysis";

export const AI_FEATURES = [
  { id: "personalized_menu" as const, label: "Personalized Menu", icon: "✨", desc: "Menu ranked for your taste, history & dietary prefs" },
  { id: "favorite_prediction" as const, label: "Favorite Prediction", icon: "🔮", desc: "AI predicts what you'll love next" },
  { id: "combo_recommendations" as const, label: "Smart Combos", icon: "🍱", desc: "Curated meal bundles that save money" },
  { id: "ai_upselling" as const, label: "AI Upselling", icon: "📈", desc: "Smart add-ons to complete your meal" },
  { id: "dietary_suggestions" as const, label: "Dietary AI", icon: "🥗", desc: "Safe picks aligned to your diet" },
  { id: "spending_analysis" as const, label: "Spending Analysis", icon: "📊", desc: "Insights on your dining patterns" },
];

export const COMBO_BUNDLES = [
  { id: "classic_thali", name: "Classic Indian Thali", items: ["Thali Combo", "Masala Chai"], save: 15, price: 62, reason: "Most ordered lunch combo" },
  { id: "tikka_feast", name: "Tikka Feast", items: ["Chicken Tikka", "Butter Chicken", "Garlic Naan"], save: 20, price: 145, reason: "Perfect for 2 guests" },
  { id: "healthy_bowl", name: "Healthy Power Bowl", items: ["Quinoa Buddha Bowl", "Fresh Lime Soda"], save: 10, price: 48, reason: "Under 500 cal · high protein" },
  { id: "date_night", name: "Date Night Special", items: ["Paneer Tikka", "Dal Makhani", "Gulab Jamun", "Mocktail"], save: 25, price: 165, reason: "Romantic dinner for two" },
];

export const DIETARY_AI_TIPS: Record<string, { tip: string; picks: string[] }> = {
  veg: { tip: "Showing vegetarian-safe items with no hidden meat stock", picks: ["Palak Paneer", "Masala Dosa", "Thali Combo"] },
  "non-veg": { tip: "Premium protein picks based on your order history", picks: ["Butter Chicken", "Tandoori Mixed Grill", "Chicken Tikka"] },
  vegan: { tip: "100% plant-based — no dairy, eggs, or honey", picks: ["Quinoa Buddha Bowl", "Sugar-Free Sorbet", "Vada Pav"] },
  jain: { tip: "No onion, garlic, or root vegetables", picks: ["Samosa Platter", "Jain Thali"] },
  "gluten-free": { tip: "Naturally gluten-free or GF-prepared dishes", picks: ["Tandoori Mixed Grill", "Grilled Salmon Salad", "Masala Dosa"] },
  keto: { tip: "Low carb, high fat — under 10g net carbs", picks: ["Keto Chicken Bowl", "Grilled Salmon Salad"] },
  "sugar-free": { tip: "No added sugar desserts & beverages", picks: ["Sugar-Free Sorbet", "Black Coffee"] },
  organic: { tip: "Certified organic ingredients where available", picks: ["Quinoa Buddha Bowl"] },
  all: { tip: "Full menu — apply a filter for tailored AI picks", picks: ["Butter Chicken", "Chicken Tikka", "Gulab Jamun"] },
};

export const DEMO_PERSONALIZED_MENU = [
  { menuItemId: 103, name: "Butter Chicken", score: 98, reason: "Ordered 4 times · matches your taste profile", price: 65 },
  { menuItemId: 101, name: "Chicken Tikka", score: 94, reason: "Chef pick · similar to your favorites", price: 45 },
  { menuItemId: 105, name: "Gulab Jamun", score: 88, reason: "You often add dessert", price: 22 },
  { menuItemId: 109, name: "Quinoa Buddha Bowl", score: 82, reason: "Trending for Gold members", price: 42 },
];

export const DEMO_FAVORITE_PREDICTIONS = [
  { menuItemId: 103, name: "Butter Chicken", confidence: 92, reason: "89% of guests like you reorder this", price: 65 },
  { menuItemId: 99, name: "Tandoori Mixed Grill", confidence: 85, reason: "Pairs with your usual starters", price: 85 },
  { menuItemId: 106, name: "Sugar-Free Sorbet", confidence: 78, reason: "Light dessert match after mains", price: 26 },
];

export const DEMO_SPENDING = {
  totalSpend: 12400,
  avgOrderValue: 689,
  orderCount: 18,
  topCategory: "Main Course",
  monthlyTrend: "+12%",
  insights: [
    "You spend 35% more on weekends — try weekday lunch combos to save",
    "Your average order is ₹689 — adding a beverage adds only ₹35 avg",
    "Main course is 60% of your spend — explore starter combos for variety",
  ],
  categoryBreakdown: [
    { category: "Main Course", percent: 60, amount: 7440 },
    { category: "Starters", percent: 20, amount: 2480 },
    { category: "Beverages", percent: 12, amount: 1488 },
    { category: "Desserts", percent: 8, amount: 992 },
  ],
  suggestedBudget: 750,
};

export const DEMO_UPSELLS = [
  { menuItemId: 105, name: "Gulab Jamun", reason: "Complete your meal with dessert", type: "combo", uplift: 22 },
  { menuItemId: 0, name: "Mango Lassi", reason: "89% pair mains with a beverage", type: "ai_upsell", uplift: 35 },
  { menuItemId: 101, name: "Chicken Tikka", reason: "Popular starter before mains", type: "upsell", uplift: 45 },
];
