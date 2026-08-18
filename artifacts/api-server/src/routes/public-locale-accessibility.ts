import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, guestUsersTable, menuItemsTable } from "@workspace/db";
import {
  getLocaleCatalog, getTranslations, buildVoiceMenuScript,
  normalizeAccessibility, mergeDeviceAccessibility,
} from "../lib/localeAccessibilityLogic.js";

const router: IRouter = Router();

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

router.get("/public/locale/catalog", (_req, res) => {
  res.json(getLocaleCatalog());
});

router.get("/public/locale/translations/:lang", (req, res) => {
  res.json(getTranslations(req.params.lang));
});

router.get("/public/locale/preferences", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) {
    res.json({
      language: "en",
      accessibility: normalizeAccessibility(null),
      authenticated: false,
    });
    return;
  }
  const deviceInfo = (typeof guest.deviceInfo === "object" && guest.deviceInfo !== null
    ? guest.deviceInfo : {}) as Record<string, unknown>;
  res.json({
    language: guest.language ?? "en",
    accessibility: normalizeAccessibility(deviceInfo.accessibility),
    timezone: guest.timezone ?? "Asia/Kolkata",
    authenticated: true,
  });
});

router.patch("/public/locale/preferences", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const { language, accessibility } = req.body;

  if (!guest) {
    res.json({
      saved: false,
      language: language ?? "en",
      accessibility: normalizeAccessibility(accessibility),
      message: "Preferences applied locally — sign in to sync across devices",
    });
    return;
  }

  const deviceInfo = mergeDeviceAccessibility(guest.deviceInfo, accessibility ?? {});
  const updates: Record<string, unknown> = { deviceInfo };
  if (language) updates.language = String(language).slice(0, 5);

  const [updated] = await db.update(guestUsersTable)
    .set(updates)
    .where(eq(guestUsersTable.id, guest.id))
    .returning();

  const info = (typeof updated.deviceInfo === "object" && updated.deviceInfo !== null
    ? updated.deviceInfo : {}) as Record<string, unknown>;

  res.json({
    saved: true,
    language: updated.language,
    accessibility: normalizeAccessibility(info.accessibility),
  });
});

router.post("/public/locale/voice-menu", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const lang = String(req.body.language ?? "en");
  const limit = Math.min(parseInt(String(req.body.limit ?? 10), 10) || 10, 30);

  let items: { name: string; price: number; description?: string }[] = [];
  if (restaurantId) {
    const rows = await db.select().from(menuItemsTable)
      .where(eq(menuItemsTable.restaurantId, restaurantId))
      .limit(limit);
    items = rows.map(r => ({
      name: r.name,
      price: parseFloat(String(r.discountedPrice ?? r.price ?? 0)),
      description: r.description ?? undefined,
    }));
  }

  if (items.length === 0 && Array.isArray(req.body.items)) {
    items = req.body.items.map((i: { name?: string; price?: number; description?: string }) => ({
      name: String(i.name ?? "Item"),
      price: parseFloat(String(i.price ?? 0)),
      description: i.description,
    }));
  }

  res.json(buildVoiceMenuScript(items, lang));
});

export default router;
