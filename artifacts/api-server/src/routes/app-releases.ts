import express, { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import {
  db, appReleasesTable, appReleaseChunksTable, appReleaseVisibilityTable,
  restaurantsTable, APP_KEYS,
} from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import { type AdminRequest } from "../middlewares/superadmin-auth.js";

const router: IRouter = Router();

/** Display metadata for the three staff apps — kept here so both panels agree. */
export const APP_CATALOG: Record<string, { name: string; tagline: string; role: string; accent: string }> = {
  kitchen: {
    name: "Fastap Kitchen",
    tagline: "For chefs — incoming orders, cooking timers, mark ready",
    role: "Chef / Kitchen staff",
    accent: "#f97316",
  },
  waiter: {
    name: "Fastap Waiter",
    tagline: "For waiters — serve orders, collect payment, clear tables",
    role: "Waiter / Steward",
    accent: "#3b82f6",
  },
  housekeeping: {
    name: "Fastap Housekeeping",
    tagline: "For housekeeping — room cleaning and maintenance tasks",
    role: "Housekeeping staff",
    accent: "#10b981",
  },
};

function isAppKey(value: unknown): value is string {
  return typeof value === "string" && (APP_KEYS as readonly string[]).includes(value);
}

/** The published build of an app, or undefined when nothing has been released yet. */
async function latestPublished(appKey: string) {
  const [row] = await db
    .select()
    .from(appReleasesTable)
    .where(and(eq(appReleasesTable.appKey, appKey), eq(appReleasesTable.status, "published")))
    .orderBy(desc(appReleasesTable.publishedAt), desc(appReleasesTable.id))
    .limit(1);
  return row;
}

/** A missing visibility row means "visible" — new restaurants get every app by default. */
async function visibleAppsFor(restaurantId: number): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(appReleaseVisibilityTable)
    .where(eq(appReleaseVisibilityTable.restaurantId, restaurantId));
  const hidden = new Set(rows.filter(r => !r.visible).map(r => r.appKey));
  return new Set(APP_KEYS.filter(k => !hidden.has(k)));
}

function publicRelease(release: typeof appReleasesTable.$inferSelect | undefined, appKey: string, slug?: string) {
  const meta = APP_CATALOG[appKey]!;
  if (!release) {
    return { appKey, ...meta, available: false as const };
  }
  const query = slug ? `?r=${encodeURIComponent(slug)}` : "";
  return {
    appKey,
    ...meta,
    available: true as const,
    version: release.version,
    changelog: release.changelog ?? "",
    fileName: release.fileName ?? `Fastap-${appKey}.apk`,
    fileSize: release.fileSize,
    downloads: release.downloads,
    publishedAt: release.publishedAt ? release.publishedAt.toISOString() : null,
    // Always our own URL: a link-hosted build redirects from here, so the QR code
    // and the download button never have to change shape.
    downloadPath: `/api/public/app-releases/${appKey}/download${query}`,
  };
}

// ───────────────────────── Owner panel ─────────────────────────

/** What this restaurant's Staff Apps page shows. */
router.get("/restaurants/:restaurantId/staff-apps", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  if (!Number.isFinite(restaurantId)) {
    res.status(400).json({ error: "Invalid restaurant id" });
    return;
  }
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId)).limit(1);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  const visible = await visibleAppsFor(restaurantId);
  const apps = [];
  for (const key of APP_KEYS) {
    if (!visible.has(key)) continue;
    apps.push(publicRelease(await latestPublished(key), key, restaurant.slug));
  }
  res.json({ apps, restaurantSlug: restaurant.slug });
});

// ───────────────────────── Public (staff phone) ─────────────────────────

/**
 * The QR code on the owner's page points here. It has to work without a login —
 * the waiter scanning it on their own phone is not signed in to anything yet.
 */
router.get("/public/app-releases/:appKey/download", async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? "");
  if (!isAppKey(appKey)) {
    res.status(404).json({ error: "Unknown app" });
    return;
  }

  // When the link carries the restaurant it was generated for, honour that
  // restaurant's show/hide switch — hiding an app kills its link too.
  const slug = typeof req.query.r === "string" ? req.query.r : undefined;
  if (slug) {
    const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug)).limit(1);
    if (restaurant) {
      const visible = await visibleAppsFor(restaurant.id);
      if (!visible.has(appKey)) {
        res.status(404).json({ error: "This app is not available for your restaurant" });
        return;
      }
    }
  }

  const release = await latestPublished(appKey);
  if (!release) {
    res.status(404).json({ error: "No published build yet" });
    return;
  }

  await db.update(appReleasesTable)
    .set({ downloads: release.downloads + 1 })
    .where(eq(appReleasesTable.id, release.id));

  if (release.storage === "link" && release.downloadUrl) {
    res.redirect(302, release.downloadUrl);
    return;
  }

  const chunks = await db
    .select({ idx: appReleaseChunksTable.idx })
    .from(appReleaseChunksTable)
    .where(eq(appReleaseChunksTable.releaseId, release.id))
    .orderBy(asc(appReleaseChunksTable.idx));
  if (!chunks.length) {
    res.status(404).json({ error: "Build file is missing" });
    return;
  }

  res.setHeader("Content-Type", release.contentType);
  res.setHeader("Content-Length", String(release.fileSize));
  res.setHeader("Content-Disposition", `attachment; filename="${release.fileName ?? `Fastap-${appKey}.apk`}"`);
  res.setHeader("Cache-Control", "no-store");

  // One chunk at a time: an 80 MB APK never sits in memory whole.
  for (const { idx } of chunks) {
    const [row] = await db
      .select({ data: appReleaseChunksTable.data })
      .from(appReleaseChunksTable)
      .where(and(eq(appReleaseChunksTable.releaseId, release.id), eq(appReleaseChunksTable.idx, idx)))
      .limit(1);
    if (!row) break;
    if (!res.write(row.data)) {
      await new Promise<void>(resolve => res.once("drain", () => resolve()));
    }
  }
  res.end();
});

// ───────────────────────── Super admin ─────────────────────────

/** Every restaurant with its per-app show/hide switches. */
router.get("/superadmin/app-releases/visibility", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const restaurants = await db
    .select({
      id: restaurantsTable.id,
      name: restaurantsTable.name,
      slug: restaurantsTable.slug,
      isActive: restaurantsTable.isActive,
      plan: restaurantsTable.plan,
    })
    .from(restaurantsTable)
    .orderBy(asc(restaurantsTable.name));

  const rows = restaurants.length
    ? await db.select().from(appReleaseVisibilityTable).where(
        inArray(appReleaseVisibilityTable.restaurantId, restaurants.map(r => r.id)),
      )
    : [];

  const hidden = new Map<string, boolean>();
  for (const row of rows) hidden.set(`${row.restaurantId}:${row.appKey}`, row.visible);

  res.json({
    restaurants: restaurants.map(r => ({
      ...r,
      apps: Object.fromEntries(APP_KEYS.map(k => [k, hidden.get(`${r.id}:${k}`) ?? true])),
    })),
  });
});

/** Flip one app on or off for one restaurant. */
router.put("/superadmin/app-releases/visibility", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { restaurantId, appKey, visible } = req.body ?? {};
  if (!Number.isFinite(Number(restaurantId)) || !isAppKey(appKey) || typeof visible !== "boolean") {
    res.status(400).json({ error: "restaurantId, appKey and visible are required" });
    return;
  }
  await db
    .insert(appReleaseVisibilityTable)
    .values({ restaurantId: Number(restaurantId), appKey, visible })
    .onConflictDoUpdate({
      target: [appReleaseVisibilityTable.restaurantId, appReleaseVisibilityTable.appKey],
      set: { visible, updatedAt: new Date() },
    });
  res.json({ success: true, restaurantId: Number(restaurantId), appKey, visible });
});

/** Turn one app on or off for every restaurant at once. */
router.put("/superadmin/app-releases/visibility/bulk", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { appKey, visible } = req.body ?? {};
  if (!isAppKey(appKey) || typeof visible !== "boolean") {
    res.status(400).json({ error: "appKey and visible are required" });
    return;
  }
  const restaurants = await db.select({ id: restaurantsTable.id }).from(restaurantsTable);
  for (const r of restaurants) {
    await db
      .insert(appReleaseVisibilityTable)
      .values({ restaurantId: r.id, appKey, visible })
      .onConflictDoUpdate({
        target: [appReleaseVisibilityTable.restaurantId, appReleaseVisibilityTable.appKey],
        set: { visible, updatedAt: new Date() },
      });
  }
  res.json({ success: true, updated: restaurants.length, appKey, visible });
});

/** All builds, newest first, plus what is live right now for each app. */
router.get("/superadmin/app-releases", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const releases = await db.select().from(appReleasesTable).orderBy(desc(appReleasesTable.id));
  const live: Record<string, number | null> = {};
  for (const key of APP_KEYS) {
    const current = releases.find(r => r.appKey === key && r.status === "published");
    live[key] = current?.id ?? null;
  }
  res.json({
    catalog: APP_KEYS.map(key => ({ appKey: key, ...APP_CATALOG[key]!, liveReleaseId: live[key] ?? null })),
    releases: releases.map(r => ({
      ...r,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

/** Start a new build. For a file upload this creates the draft the chunks attach to. */
router.post("/superadmin/app-releases", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { appKey, version, changelog, fileName, fileSize, storage, downloadUrl } = req.body ?? {};
  if (!isAppKey(appKey) || typeof version !== "string" || !version.trim()) {
    res.status(400).json({ error: "appKey and version are required" });
    return;
  }
  const mode = storage === "link" ? "link" : "db";
  if (mode === "link" && (typeof downloadUrl !== "string" || !/^https?:\/\//i.test(downloadUrl))) {
    res.status(400).json({ error: "A valid https download link is required" });
    return;
  }

  const [release] = await db.insert(appReleasesTable).values({
    appKey,
    version: version.trim(),
    changelog: typeof changelog === "string" ? changelog.trim() : null,
    fileName: typeof fileName === "string" && fileName ? fileName : `Fastap-${appKey}.apk`,
    fileSize: Number.isFinite(Number(fileSize)) ? Number(fileSize) : 0,
    storage: mode,
    downloadUrl: mode === "link" ? String(downloadUrl) : null,
    // A link build has nothing to upload, so it is ready to publish straight away.
    status: mode === "link" ? "ready" : "draft",
    publishedBy: (req as AdminRequest).adminUser?.email ?? null,
  }).returning();

  res.status(201).json({ release });
});

/**
 * One slice of the APK. The browser sends 4 MB at a time so neither side has to
 * hold the whole file, and a dropped connection only loses one slice.
 */
router.post(
  "/superadmin/app-releases/:id/chunk",
  requireSuperAdmin,
  express.raw({ type: () => true, limit: "12mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    const idx = parseInt(String(req.query.index ?? ""), 10);
    if (!Number.isFinite(id) || !Number.isFinite(idx) || idx < 0) {
      res.status(400).json({ error: "Invalid release or chunk index" });
      return;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty chunk" });
      return;
    }
    const [release] = await db.select().from(appReleasesTable).where(eq(appReleasesTable.id, id)).limit(1);
    if (!release) {
      res.status(404).json({ error: "Release not found" });
      return;
    }
    if (release.status === "published" || release.status === "archived") {
      res.status(409).json({ error: "This build is already published" });
      return;
    }

    // Re-sending a slice after a retry must not double-count the bytes.
    const [existing] = await db
      .select({ id: appReleaseChunksTable.id })
      .from(appReleaseChunksTable)
      .where(and(eq(appReleaseChunksTable.releaseId, id), eq(appReleaseChunksTable.idx, idx)))
      .limit(1);

    if (existing) {
      await db.update(appReleaseChunksTable).set({ data: body }).where(eq(appReleaseChunksTable.id, existing.id));
    } else {
      await db.insert(appReleaseChunksTable).values({ releaseId: id, idx, data: body });
      await db.update(appReleasesTable)
        .set({ uploadedBytes: release.uploadedBytes + body.length })
        .where(eq(appReleasesTable.id, id));
    }
    res.json({ success: true, idx, received: body.length });
  },
);

/** Go live. The previous build for this app is archived and its bytes are freed. */
router.post("/superadmin/app-releases/:id/publish", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [release] = await db.select().from(appReleasesTable).where(eq(appReleasesTable.id, id)).limit(1);
  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  if (release.storage === "db") {
    const chunks = await db
      .select({ idx: appReleaseChunksTable.idx })
      .from(appReleaseChunksTable)
      .where(eq(appReleaseChunksTable.releaseId, id));
    if (!chunks.length) {
      res.status(400).json({ error: "Upload the APK file before publishing" });
      return;
    }
    if (release.fileSize > 0 && release.uploadedBytes < release.fileSize) {
      res.status(400).json({ error: "Upload is incomplete — some parts of the file are missing" });
      return;
    }
  }

  const previous = await db
    .select()
    .from(appReleasesTable)
    .where(and(eq(appReleasesTable.appKey, release.appKey), eq(appReleasesTable.status, "published")));

  await db.update(appReleasesTable)
    .set({ status: "archived" })
    .where(and(eq(appReleasesTable.appKey, release.appKey), eq(appReleasesTable.status, "published")));

  await db.update(appReleasesTable)
    .set({
      status: "published",
      publishedAt: new Date(),
      publishedBy: (req as AdminRequest).adminUser?.email ?? release.publishedBy,
    })
    .where(eq(appReleasesTable.id, id));

  // Keep only the build we just replaced as a rollback copy; anything older than
  // that loses its bytes so the database does not grow by 80 MB every release.
  const older = await db
    .select({ id: appReleasesTable.id })
    .from(appReleasesTable)
    .where(and(eq(appReleasesTable.appKey, release.appKey), eq(appReleasesTable.status, "archived")))
    .orderBy(desc(appReleasesTable.id));
  const keep = new Set([id, ...previous.map(p => p.id)]);
  const drop = older.map(o => o.id).filter(oid => !keep.has(oid));
  if (drop.length) {
    await db.delete(appReleaseChunksTable).where(inArray(appReleaseChunksTable.releaseId, drop));
  }

  res.json({ success: true, id, appKey: release.appKey, version: release.version });
});

/** Delete a build outright (chunks go with it via the cascade). */
router.delete("/superadmin/app-releases/:id", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [release] = await db.select().from(appReleasesTable).where(eq(appReleasesTable.id, id)).limit(1);
  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  if (release.status === "published") {
    res.status(409).json({ error: "This build is live. Publish another version first, then delete this one." });
    return;
  }
  await db.delete(appReleaseChunksTable).where(eq(appReleaseChunksTable.releaseId, id));
  await db.delete(appReleasesTable).where(eq(appReleasesTable.id, id));
  res.json({ success: true });
});

export default router;
