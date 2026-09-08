import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";
import { DEFAULT_PERMISSIONS } from "../lib/staff-permission-defaults.js";

const router: IRouter = Router();

const PERMISSION_GROUPS = [
  { group: "Orders", perms: ["view_orders", "edit_orders", "cancel_orders", "refund_orders"] },
  { group: "Menu", perms: ["add_menu", "edit_pricing", "delete_menu", "hide_menu"] },
  { group: "Finance", perms: ["view_wallet", "view_settlements", "view_reports"] },
  { group: "Staff", perms: ["add_staff", "remove_staff", "edit_salary"] },
  { group: "Inventory", perms: ["edit_stock", "approve_purchase"] },
  { group: "Marketing", perms: ["create_campaigns", "send_promotions"] },
  { group: "Settings", perms: ["qr_controls", "nfc_controls", "printer_settings"] },
  { group: "Advanced", perms: ["time_based_access", "device_based_access", "branch_wise_access", "approval_workflows", "activity_tracking"] },
];

/** A fresh copy every time — see loadPermissions. */
function cloneDefaults(): Record<string, Record<string, boolean>> {
  return Object.fromEntries(Object.entries(DEFAULT_PERMISSIONS).map(([role, perms]) => [role, { ...perms }]));
}

/**
 * The handlers below assign into the object this returns. It used to hand back the
 * module-level DEFAULT_PERMISSIONS itself whenever a venue had saved nothing yet, so the
 * first permission change rewrote the defaults for the whole process: every other venue
 * on the server inherited that edit, and "Reset to default" restored the edited version
 * rather than the real one. Always return a copy.
 */
async function loadPermissions(rid: number): Promise<Record<string, Record<string, boolean>>> {
  const base = cloneDefaults();
  const stored = await getSettingsSection<Record<string, Record<string, boolean>> | null>(rid, "rbac", null);
  if (stored && Object.keys(stored).length > 0) {
    for (const [role, perms] of Object.entries(stored)) base[role] = { ...perms };
  }
  return base;
}

router.get("/restaurants/:restaurantId/rbac", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const perms = await loadPermissions(rid);
  res.json({ permissions: perms, groups: PERMISSION_GROUPS, roles: Object.keys(DEFAULT_PERMISSIONS) });
});

router.put("/restaurants/:restaurantId/rbac/:role", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const role = req.params.role;
  const { permissions } = req.body;
  const current = await loadPermissions(rid);
  current[role] = { ...(DEFAULT_PERMISSIONS[role] || {}), ...permissions };
  await setSettingsSection(rid, "rbac", current);
  res.json({ success: true, role, permissions: current[role] });
});

router.put("/restaurants/:restaurantId/rbac", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { permissions } = req.body as { permissions?: Record<string, Record<string, boolean>> };
  if (!permissions || typeof permissions !== "object") {
    res.status(400).json({ error: "permissions object required" });
    return;
  }
  const current = await loadPermissions(rid);
  for (const [role, perms] of Object.entries(permissions)) {
    current[role] = { ...(DEFAULT_PERMISSIONS[role] || {}), ...perms };
  }
  await setSettingsSection(rid, "rbac", current);
  res.json({ success: true, permissions: current });
});

router.post("/restaurants/:restaurantId/rbac/reset/:role", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const role = req.params.role;
  const current = await loadPermissions(rid);
  if (DEFAULT_PERMISSIONS[role]) current[role] = { ...DEFAULT_PERMISSIONS[role] };
  await setSettingsSection(rid, "rbac", current);
  res.json({ success: true, permissions: DEFAULT_PERMISSIONS[role] || {} });
});

export { DEFAULT_PERMISSIONS, loadPermissions };
export default router;
