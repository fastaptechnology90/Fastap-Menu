import { Router, type IRouter } from "express";
import { catalogPayload } from "../lib/feature-modules/catalog.js";
import {
  getAdminFeatureControls,
  setAdminFeatureOverrides,
  getRestaurantFeatureControls,
  setRestaurantFeatureToggles,
} from "../lib/feature-modules/entitlements.js";

const router: IRouter = Router();

/** Public catalog — used by admin panels and mobile app bootstrap. */
router.get("/feature-modules/catalog", (_req, res) => {
  res.json(catalogPayload());
});

export default router;

export function registerSuperAdminFeatureRoutes(
  adminRouter: IRouter,
  adminMiddleware: Parameters<IRouter["get"]>[1][],
) {
  adminRouter.get(
    "/superadmin/vendors/:vendorId/features",
    ...adminMiddleware,
    async (req, res) => {
      const id = parseInt(req.params.vendorId, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid vendor id" });
        return;
      }
      res.json(await getAdminFeatureControls(id));
    },
  );

  adminRouter.put(
    "/superadmin/vendors/:vendorId/features",
    ...adminMiddleware,
    async (req, res) => {
      const id = parseInt(req.params.vendorId, 10);
      const { overrides } = req.body as { overrides?: Record<string, boolean> };
      if (!Number.isFinite(id) || !overrides) {
        res.status(400).json({ error: "overrides object required" });
        return;
      }
      res.json(await setAdminFeatureOverrides(id, overrides));
    },
  );
}

export function registerRestaurantFeatureRoutes(
  restaurantRouter: IRouter,
  requireAuth: Parameters<IRouter["get"]>[1],
) {
  restaurantRouter.get(
    "/restaurants/:restaurantId/features",
    requireAuth,
    async (req, res) => {
      const id = parseInt(req.params.restaurantId, 10);
      res.json(await getRestaurantFeatureControls(id));
    },
  );

  restaurantRouter.put(
    "/restaurants/:restaurantId/features",
    requireAuth,
    async (req, res) => {
      const id = parseInt(req.params.restaurantId, 10);
      const { toggles } = req.body as { toggles?: Record<string, boolean> };
      if (!toggles) {
        res.status(400).json({ error: "toggles object required" });
        return;
      }
      res.json(await setRestaurantFeatureToggles(id, toggles));
    },
  );
}
