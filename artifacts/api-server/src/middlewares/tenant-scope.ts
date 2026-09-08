import { type Request, type Response, type NextFunction } from "express";
import { getAccessibleRestaurant } from "../lib/restaurant-access.js";
import { logger } from "../lib/logger.js";

/**
 * Enforce that a signed-in caller may only touch their own restaurant.
 *
 * The gap this closes
 * -------------------
 * `requireAuth` only asks "is anyone signed in". Every panel route then took the
 * restaurant id straight from the URL and trusted it, and the helper that checks
 * ownership (`getAccessibleRestaurant`) was called by three route files out of
 * seventy-two. So a signed-in owner or staff member could read and write any other
 * venue's orders, staff, menu and finance simply by changing a number in the path.
 *
 * Rather than adding a call to seventy more files — and relying on nobody forgetting
 * it in the seventy-first — the check runs here, once, for every request whose path
 * names a restaurant. New routes are covered the moment they are added.
 *
 * `getAccessibleRestaurant` already encodes the three legitimate cases: a staff
 * session scoped to that restaurant, a super admin, or the owning user account.
 */

/** Matches the id in `/restaurants/123/...`, the shape every panel route uses. */
const RESTAURANT_PATH = /^\/restaurants\/(\d+)(?:\/|$)/;

/**
 * Paths that legitimately carry no restaurant session, or that guard themselves.
 *  - `/public`  guest surface, unauthenticated by design
 *  - `/auth`, `/restaurant-auth`  sign-in itself
 *  - `/v1`  the mobile apps, which carry their own bearer session and are scoped
 *           to the staff member's restaurant inside `requireMobileAuth`
 *  - `/superadmin`  guarded by `requireSuperAdmin`, which checks the role properly
 *  - `/health`  liveness probe
 */
const SKIP_PREFIXES = [
  "/public",
  "/auth",
  "/restaurant-auth",
  "/v1",
  "/superadmin",
  "/health",
];

export async function requireTenantScope(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const path = req.path;

  if (SKIP_PREFIXES.some(prefix => path.startsWith(prefix))) {
    next();
    return;
  }

  const match = RESTAURANT_PATH.exec(path);
  if (!match) {
    next();
    return;
  }

  const restaurantId = Number(match[1]);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
    res.status(400).json({ error: "Invalid restaurant id" });
    return;
  }

  // No session at all — let the route's own requireAuth produce the 401, so the
  // caller still gets "not signed in" rather than a confusing "access denied".
  if (!req.session.userId && !req.session.staffSession) {
    next();
    return;
  }

  const restaurant = await getAccessibleRestaurant(req, restaurantId);
  if (!restaurant) {
    logger.warn(
      {
        path,
        method: req.method,
        restaurantId,
        userId: req.session.userId ?? null,
        staffRestaurantId: req.session.staffSession?.restaurantId ?? null,
      },
      "cross-tenant request refused",
    );
    // Deliberately the same shape whether the restaurant is missing or simply not
    // theirs — otherwise this endpoint becomes a way to enumerate which ids exist.
    res.status(403).json({ error: "Access denied for this restaurant" });
    return;
  }

  next();
}
