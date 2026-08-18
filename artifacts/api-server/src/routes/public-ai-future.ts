import { Router, type IRouter } from "express";

const router: IRouter = Router();

const FUTURE_FEATURES = [
  { id: "voice_ordering", label: "AI Voice Ordering", icon: "🎙️", status: "coming_soon", desc: "Order by speaking naturally — no typing needed", eta: "Q3 2026" },
  { id: "virtual_waiter", label: "AI Virtual Waiter", icon: "🤖", status: "coming_soon", desc: "24/7 conversational dining assistant at your table", eta: "Q3 2026" },
  { id: "food_visualizer", label: "AI Food Visualizer", icon: "🖼️", status: "beta", desc: "See your customized dish before ordering", eta: "Q2 2026" },
  { id: "mood_detection", label: "AI Mood Detection", icon: "😊", status: "research", desc: "Menu adapts to your mood and occasion", eta: "Q4 2026" },
  { id: "event_planner", label: "AI Event Planner", icon: "🎊", status: "coming_soon", desc: "Plan weddings, birthdays & corporate events with AI", eta: "Q3 2026" },
  { id: "hospitality_concierge", label: "AI Hospitality Concierge", icon: "🏨", status: "coming_soon", desc: "Full resort concierge — spa, dining, activities", eta: "Q4 2026" },
  { id: "nutrition_planner", label: "AI Nutrition Planner", icon: "🥗", status: "beta", desc: "Personalized macro-balanced meal plans", eta: "Q2 2026" },
  { id: "dining_assistant", label: "AI Dining Assistant", icon: "✨", status: "coming_soon", desc: "End-to-end smart dining companion", eta: "Q3 2026" },
];

const waitlist: { email?: string; phone?: string; featureId: string; at: string }[] = [];

router.get("/public/ai-future/catalog", (_req, res) => {
  res.json({
    features: FUTURE_FEATURES,
    roadmap: FUTURE_FEATURES.map(f => ({ id: f.id, label: f.label, status: f.status, eta: f.eta })),
    waitlistCount: waitlist.length,
  });
});

router.post("/public/ai-future/waitlist", (req, res) => {
  const featureId = String(req.body.featureId ?? "");
  const email = req.body.email ? String(req.body.email) : undefined;
  const phone = req.body.phone ? String(req.body.phone) : undefined;
  if (!featureId || (!email && !phone)) {
    res.status(400).json({ error: "featureId and email or phone required" });
    return;
  }
  waitlist.push({ featureId, email, phone, at: new Date().toISOString() });
  res.status(201).json({ success: true, message: "You're on the waitlist! We'll notify you when this feature launches." });
});

export default router;
