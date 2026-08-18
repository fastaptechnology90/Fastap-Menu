import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  owner:        { view_orders: true, edit_orders: true, cancel_orders: true, refund_orders: true, add_menu: true, edit_pricing: true, delete_menu: true, hide_menu: true, view_wallet: true, view_settlements: true, view_reports: true, add_staff: true, remove_staff: true, edit_salary: true, edit_stock: true, approve_purchase: true, create_campaigns: true, send_promotions: true, qr_controls: true, nfc_controls: true, printer_settings: true, time_based_access: true, device_based_access: true, branch_wise_access: true, approval_workflows: true, activity_tracking: true },
  manager:      { view_orders: true, edit_orders: true, cancel_orders: true, refund_orders: false, add_menu: true, edit_pricing: true, delete_menu: false, hide_menu: true, view_wallet: true, view_settlements: false, view_reports: true, add_staff: true, remove_staff: false, edit_salary: false, edit_stock: true, approve_purchase: true, create_campaigns: true, send_promotions: true, qr_controls: true, nfc_controls: false, printer_settings: true, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: true },
  cashier:      { view_orders: true, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: true, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  waiter:       { view_orders: true, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  kitchen:      { view_orders: true, edit_orders: true, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: true, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: true, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  chef:         { view_orders: true, edit_orders: true, cancel_orders: false, refund_orders: false, add_menu: true, edit_pricing: true, delete_menu: false, hide_menu: true, view_wallet: false, view_settlements: false, view_reports: true, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: true, approve_purchase: true, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: true, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  reception:    { view_orders: true, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  finance:      { view_orders: true, edit_orders: false, cancel_orders: false, refund_orders: true, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: true, view_settlements: true, view_reports: true, add_staff: false, remove_staff: false, edit_salary: true, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: true },
  hr:           { view_orders: false, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: true, add_staff: true, remove_staff: true, edit_salary: true, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: true },
  bar:          { view_orders: true, edit_orders: true, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: true, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: true, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: true, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  spa:          { view_orders: false, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  housekeeping: { view_orders: false, edit_orders: false, cancel_orders: false, refund_orders: false, add_menu: false, edit_pricing: false, delete_menu: false, hide_menu: false, view_wallet: false, view_settlements: false, view_reports: false, add_staff: false, remove_staff: false, edit_salary: false, edit_stock: false, approve_purchase: false, create_campaigns: false, send_promotions: false, qr_controls: false, nfc_controls: false, printer_settings: false, time_based_access: false, device_based_access: false, branch_wise_access: false, approval_workflows: false, activity_tracking: false },
  franchise:    { view_orders: true, edit_orders: true, cancel_orders: true, refund_orders: true, add_menu: true, edit_pricing: true, delete_menu: true, hide_menu: true, view_wallet: true, view_settlements: true, view_reports: true, add_staff: true, remove_staff: true, edit_salary: true, edit_stock: true, approve_purchase: true, create_campaigns: true, send_promotions: true, qr_controls: true, nfc_controls: true, printer_settings: true, time_based_access: true, device_based_access: true, branch_wise_access: true, approval_workflows: true, activity_tracking: true },
};

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

async function loadPermissions(rid: number): Promise<Record<string, Record<string, boolean>>> {
  const stored = await getSettingsSection<Record<string, Record<string, boolean>> | null>(rid, "rbac", null);
  if (stored && Object.keys(stored).length > 0) return { ...DEFAULT_PERMISSIONS, ...stored };
  return DEFAULT_PERMISSIONS;
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
