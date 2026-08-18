import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

const DEFAULT_SIGNAGE = {
  settings: { enabled: true, rotation_speed: 10, theme: "dark", show_prices: true, show_images: true, show_promotions: true, font_size: "medium", display_mode: "auto" },
  slides: [
    { id: 1, type: "banner", title: "Welcome to Our Restaurant", subtitle: "Scan QR Code to Order", bg_color: "#7c3aed", text_color: "#ffffff", active: true, order: 1 },
    { id: 2, type: "promo", title: "Happy Hour", subtitle: "20% Off on All Beverages — 4PM to 7PM", bg_color: "#f97316", text_color: "#ffffff", active: true, order: 2 },
  ],
  screens: [
    { id: 1, name: "Main Entrance", location: "Entrance", status: "online", last_ping: new Date().toISOString(), resolution: "1920x1080" },
  ],
};

function normalizeSignage(raw: unknown): typeof DEFAULT_SIGNAGE {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<typeof DEFAULT_SIGNAGE>;
  const slides = Array.isArray(r.slides)
    ? r.slides.map((slide, i) => ({
        id: slide.id ?? i + 1,
        type: slide.type ?? "promo",
        title: slide.title ?? "Untitled",
        subtitle: slide.subtitle ?? "",
        bg_color: slide.bg_color ?? "#7c3aed",
        text_color: slide.text_color ?? "#ffffff",
        active: slide.active !== false,
        order: slide.order ?? i + 1,
      }))
    : DEFAULT_SIGNAGE.slides;
  return {
    settings: { ...DEFAULT_SIGNAGE.settings, ...(r.settings ?? {}) },
    slides,
    screens: Array.isArray(r.screens) ? r.screens : DEFAULT_SIGNAGE.screens,
  };
}

async function getStore(rid: number) {
  const raw = await getSettingsSection(rid, "signage", DEFAULT_SIGNAGE);
  return normalizeSignage(raw);
}

router.get("/restaurants/:restaurantId/signage", requireAuth, async (req, res) => {
  res.json(await getStore(parseInt(req.params.restaurantId, 10)));
});

router.put("/restaurants/:restaurantId/signage/settings", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const s = await getStore(rid);
  s.settings = { ...s.settings, ...req.body };
  await setSettingsSection(rid, "signage", s);
  res.json(s.settings);
});

router.post("/restaurants/:restaurantId/signage/slides", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const s = await getStore(rid);
  const slide = { id: Date.now(), active: true, order: s.slides.length + 1, ...req.body };
  s.slides.push(slide);
  await setSettingsSection(rid, "signage", s);
  res.status(201).json(slide);
});

router.put("/restaurants/:restaurantId/signage/slides/:id", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const sid = parseInt(req.params.id, 10);
  const s = await getStore(rid);
  const idx = s.slides.findIndex((x: any) => x.id === sid);
  if (idx === -1) { res.status(404).json({ error: "Slide not found" }); return; }
  s.slides[idx] = { ...s.slides[idx], ...req.body };
  await setSettingsSection(rid, "signage", s);
  res.json(s.slides[idx]);
});

router.delete("/restaurants/:restaurantId/signage/slides/:id", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const sid = parseInt(req.params.id, 10);
  const s = await getStore(rid);
  s.slides = s.slides.filter((x: any) => x.id !== sid);
  await setSettingsSection(rid, "signage", s);
  res.json({ success: true });
});

export default router;
