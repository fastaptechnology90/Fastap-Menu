import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, restaurantsTable, campaignsTable, guestUsersTable } from "@workspace/db";
import { getSettingsSection } from "../lib/restaurant-settings.js";
import { parseDeviceInfo } from "../lib/guestAuthLogic.js";
import {
  getDigitalExperienceCatalog, mapCampaignToOffer,
  mapSignageToBanners, getPromotionsConfig, spinWheel,
  getFestivalThemes, getSeasonalAnimations,
} from "../lib/digitalExperienceLogic.js";

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

async function loadGuestDigital(req: Request) {
  const guestUserId = req.session?.guestUserId;
  if (!guestUserId) return { key: guestKey(req), digital: { claimedOffers: [] as string[], spinHistory: [] as { prize: string; at: string }[], prefs: { festivalTheme: "default", seasonalAnimation: "none" } } };
  const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  const deviceInfo = parseDeviceInfo(guest?.deviceInfo);
  const digital = deviceInfo.digitalExperience ?? {
    claimedOffers: [],
    spinHistory: [],
    prefs: { festivalTheme: "default", seasonalAnimation: "none" },
  };
  return { key: String(guestUserId), digital, guestId: guestUserId };
}

async function saveGuestDigital(guestId: number, digital: NonNullable<ReturnType<typeof parseDeviceInfo>["digitalExperience"]>) {
  const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestId));
  if (!guest) return;
  const deviceInfo = { ...parseDeviceInfo(guest.deviceInfo), digitalExperience: digital };
  await db.update(guestUsersTable).set({ deviceInfo }).where(eq(guestUsersTable.id, guestId));
}

router.get("/public/digital-experience/catalog", (_req, res) => {
  res.json(getDigitalExperienceCatalog());
});

router.get("/public/digital-experience/offers/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  const campaigns = await db.select().from(campaignsTable).where(
    and(eq(campaignsTable.restaurantId, restaurant.id), eq(campaignsTable.isActive, true)),
  );
  const offers = campaigns.map(c => mapCampaignToOffer(c)).filter((o): o is NonNullable<typeof o> => o !== null);
  res.json({
    offers,
    restaurantName: restaurant.name,
    liveCount: offers.filter(o => o.badge === "LIVE NOW").length,
  });
});

router.get("/public/digital-experience/banners/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  const signage = await getSettingsSection(restaurant.id, "signage", { slides: [] as { type: string; title: string; subtitle?: string; active?: boolean }[] });
  res.json({
    banners: mapSignageToBanners(signage.slides),
    restaurantName: restaurant.name,
  });
});

router.get("/public/digital-experience/promotions/:slug", async (req, res): Promise<void> => {
  const restaurant = await loadRestaurant(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Venue not found" });
    return;
  }
  res.json({ ...getPromotionsConfig(), restaurantName: restaurant.name });
});

router.post("/public/digital-experience/promotions/spin", async (req, res): Promise<void> => {
  const { key, digital, guestId } = await loadGuestDigital(req);
  const result = spinWheel(key);
  const next = {
    ...digital,
    spinHistory: [{ prize: result.prize, at: new Date().toISOString() }, ...(digital.spinHistory ?? [])].slice(0, 20),
  };
  if (guestId) await saveGuestDigital(guestId, next);
  res.json(result);
});

router.post("/public/digital-experience/promotions/claim", async (req, res): Promise<void> => {
  const offerId = String(req.body.offerId ?? "");
  if (!offerId) { res.status(400).json({ error: "offerId required" }); return; }
  const { key, digital, guestId } = await loadGuestDigital(req);
  const claimKey = `${key}:${offerId}`;
  const already = (digital.claimedOffers ?? []).includes(claimKey);
  if (!already && guestId) {
    await saveGuestDigital(guestId, {
      ...digital,
      claimedOffers: [...(digital.claimedOffers ?? []), claimKey],
    });
  }
  res.json({
    success: true,
    alreadyClaimed: already,
    message: already ? "Offer already in your wallet" : "Offer claimed — apply at checkout",
  });
});

router.get("/public/digital-experience/themes", (_req, res) => {
  res.json({ themes: getFestivalThemes(), animations: getSeasonalAnimations() });
});

router.get("/public/digital-experience/preferences", async (req, res): Promise<void> => {
  const { digital } = await loadGuestDigital(req);
  res.json(digital.prefs ?? { festivalTheme: "default", seasonalAnimation: "none" });
});

router.patch("/public/digital-experience/preferences", async (req, res): Promise<void> => {
  const { digital, guestId } = await loadGuestDigital(req);
  const prefs = {
    festivalTheme: String(req.body.festivalTheme ?? digital.prefs?.festivalTheme ?? "default"),
    seasonalAnimation: String(req.body.seasonalAnimation ?? digital.prefs?.seasonalAnimation ?? "none"),
  };
  if (guestId) await saveGuestDigital(guestId, { ...digital, prefs });
  res.json(prefs);
});

export default router;
