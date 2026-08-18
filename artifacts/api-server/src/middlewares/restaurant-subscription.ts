import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, restaurantsTable } from "@workspace/db";
import { hasActiveSubscription } from "../lib/restaurant-subscription.js";

const PANEL_PATH = /^\/restaurants\/\d+/;

const SKIP_PREFIXES = [
  "/restaurant-auth",
  "/public",
  "/health",
  "/v1",
  "/superadmin",
  "/auth",
  "/feature-modules/catalog",
];

/** Block staff panel API calls when the restaurant has no active subscription. */
export async function requireRestaurantSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.session.staffSession || req.session.userId) {
    next();
    return;
  }

  const path = req.path;
  if (SKIP_PREFIXES.some(prefix => path.startsWith(prefix))) {
    next();
    return;
  }

  if (!PANEL_PATH.test(path)) {
    next();
    return;
  }

  const restaurantId = req.session.staffSession.restaurantId;
  const pathId = parseInt(path.split("/")[2] ?? "", 10);
  if (Number.isFinite(pathId) && pathId !== restaurantId) {
    res.status(403).json({ error: "Access denied for this restaurant" });
    return;
  }

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }

  if (!hasActiveSubscription(restaurant)) {
    res.status(402).json({
      error: "An active subscription is required to use the restaurant panel.",
      code: "SUBSCRIPTION_REQUIRED",
    });
    return;
  }

  next();
}
