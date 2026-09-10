import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable } from "@workspace/db";
import { demoVenueSlug, resolveVenueSlug } from "../lib/demo-venue.js";
import { logger } from "../lib/logger.js";

/**
 * The demo venue is a shop window. Nobody may write to it.
 *
 * The gap this closes
 * -------------------
 * The landing page's "Open Guest Web" / "Try Demo Menu" opens a REAL restaurant —
 * the row the `demo` alias resolves to — with a real dashboard, a real kitchen
 * screen and real staff behind it. The guest web treats the demo as view-only,
 * but that was a browser-side check, and there are ninety public write endpoints.
 * Blocking the order route alone left every other one open: a visitor browsing the
 * demo could book a table, ring a waiter, raise a housekeeping task, file a
 * support ticket, post a review, or queue an order offline and have it synced in
 * later through a different route that never saw the order guard at all.
 *
 * So the check runs here, once, for every public write. A new guest endpoint is
 * covered the day it is written rather than the day somebody remembers it.
 *
 * Reads are untouched. Browsing the demo menu is the entire point of it.
 */

/** Only writes. GET/HEAD/OPTIONS browse the demo freely. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Endpoints that must keep working on the demo, because they belong to the
 * visitor rather than to the venue.
 *
 * Signing in, starting a browsing session and validating a coupon code change
 * nothing on the restaurant's side — blocking them would break the demo itself
 * without protecting anyone. Everything not listed here is refused.
 */
const VISITOR_OWNED = [
  "/public/auth/",
  "/public/session/",
  "/public/coupons/validate",
  "/public/locale/",
  "/public/pwa/",
  "/public/me/favorites",
  "/public/ai/",
  "/public/ai-future/",
  "/public/suggest-upsell",
];

/** Cached: the demo venue's id changes only when the env var does. */
let demoIdCache: { slug: string; id: number | null } | null = null;

async function demoRestaurantId(): Promise<number | null> {
  const slug = demoVenueSlug();
  if (demoIdCache?.slug === slug) return demoIdCache.id;
  try {
    const [row] = await db.select({ id: restaurantsTable.id })
      .from(restaurantsTable).where(eq(restaurantsTable.slug, slug)).limit(1);
    demoIdCache = { slug, id: row?.id ?? null };
    return demoIdCache.id;
  } catch {
    // A database blip must not decide the demo is safe to write to.
    return null;
  }
}

/**
 * Which restaurant is this write aimed at?
 *
 * Guest routes name the venue in three different ways, so all three are checked:
 * a numeric id in the body, a slug in the path (`/public/seating/:slug/...`), and
 * the id the scan endpoint stashed on the session.
 */
async function targetsDemo(req: Request): Promise<boolean> {
  const demoId = await demoRestaurantId();
  const demoSlug = demoVenueSlug();

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

  // Top level, and one level down inside an array. The offline queue posts
  // `{ orders: [{ restaurantId, items }] }` — the id never appears at the top, so a
  // check that only read `body.restaurantId` waved the whole batch through and the
  // orders landed on the real board by a route that had never seen the order guard.
  const ids: number[] = [];
  const collect = (value: unknown) => {
    const n = Number((value as Record<string, unknown>)?.restaurantId);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  };
  collect(body);
  for (const value of Object.values(body)) {
    if (Array.isArray(value)) for (const entry of value) {
      if (entry && typeof entry === "object") collect(entry);
    }
  }

  if (ids.length) {
    if (demoId !== null && ids.includes(demoId)) return true;
    // A body naming only other real venues is those venues' business, not ours.
    return false;
  }

  const slugParam = (req.params as Record<string, string> | undefined)?.slug
    ?? (typeof body.slug === "string" ? body.slug : undefined);
  if (typeof slugParam === "string" && slugParam.trim()) {
    // `demo` is an alias; resolve it the same way the read routes do.
    if (resolveVenueSlug(slugParam.trim()) === demoSlug) return true;
    return false;
  }

  const sessionId = req.session?.restaurantId;
  if (Number.isInteger(sessionId) && demoId !== null && sessionId === demoId) return true;

  return false;
}

export async function blockDemoVenueWrites(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) { next(); return; }
  if (!req.path.startsWith("/public/")) { next(); return; }
  if (VISITOR_OWNED.some(prefix => req.path.startsWith(prefix))) { next(); return; }

  try {
    if (!(await targetsDemo(req))) { next(); return; }
  } catch (err) {
    logger.error({ err, path: req.path }, "demo venue check failed");
    next();
    return;
  }

  logger.info({ path: req.path, method: req.method }, "refused a write to the demo venue");
  res.status(403).json({
    error: "This is the demo menu — browse it freely, but nothing can be booked or ordered here. Scan the code at your table to place a real order.",
    demoVenue: true,
  });
}
