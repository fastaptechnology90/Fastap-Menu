import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, guestUsersTable } from "@workspace/db";
import { getPwaCatalog, mergePushPrefs } from "../lib/pwaExperienceLogic.js";

const router: IRouter = Router();

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

router.get("/public/pwa/catalog", (_req, res) => {
  res.json(getPwaCatalog());
});

router.get("/public/pwa/push/prefs", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) {
    res.json({ enabled: false, authenticated: false });
    return;
  }
  const info = (typeof guest.deviceInfo === "object" && guest.deviceInfo !== null ? guest.deviceInfo : {}) as Record<string, unknown>;
  res.json({ ...(info.pushPrefs ?? {}), authenticated: true });
});

router.patch("/public/pwa/push/prefs", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const prefs = req.body ?? {};
  if (!guest) {
    res.json({ saved: false, prefs, message: "Saved locally — sign in to sync" });
    return;
  }
  const deviceInfo = mergePushPrefs(guest.deviceInfo, prefs);
  const [updated] = await db.update(guestUsersTable)
    .set({ deviceInfo })
    .where(eq(guestUsersTable.id, guest.id))
    .returning();
  const info = (typeof updated.deviceInfo === "object" && updated.deviceInfo !== null ? updated.deviceInfo : {}) as Record<string, unknown>;
  res.json({ saved: true, prefs: info.pushPrefs });
});

router.post("/public/pwa/install-event", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const { platform, standalone } = req.body;
  if (guest) {
    const info = (typeof guest.deviceInfo === "object" && guest.deviceInfo !== null ? guest.deviceInfo : {}) as Record<string, unknown>;
    await db.update(guestUsersTable).set({
      deviceInfo: { ...info, pwaInstalled: true, pwaPlatform: platform, pwaStandalone: standalone, installedAt: new Date().toISOString() },
    }).where(eq(guestUsersTable.id, guest.id));
  }
  res.json({ recorded: true });
});

export default router;
