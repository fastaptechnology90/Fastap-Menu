/** Nav path → server RBAC permission keys (any match grants access) */
export const PATH_PERMISSIONS: Record<string, string[]> = {
  "/restaurant/dashboard": ["view_reports", "view_orders"],
  "/restaurant/orders": ["view_orders"],
  "/restaurant/tables": ["view_orders"],
  "/restaurant/queue": ["view_orders"],
  "/restaurant/waiter": ["view_orders"],
  "/restaurant/kitchen": ["view_orders", "edit_orders"],
  "/restaurant/billing": ["view_orders", "refund_orders"],
  "/restaurant/cash-counter": ["view_orders"],
  "/restaurant/menu": ["add_menu", "edit_pricing", "hide_menu"],
  "/restaurant/inventory": ["edit_stock"],
  "/restaurant/food-costing": ["edit_stock", "view_reports"],
  "/restaurant/procurement": ["approve_purchase", "edit_stock"],
  "/restaurant/customers": ["view_reports", "create_campaigns"],
  "/restaurant/reservations": ["view_orders"],
  "/restaurant/loyalty": ["create_campaigns", "send_promotions"],
  "/restaurant/marketing": ["create_campaigns", "send_promotions"],
  "/restaurant/reviews": ["view_reports"],
  "/restaurant/reception": ["view_orders"],
  "/restaurant/room-service": ["view_orders"],
  "/restaurant/housekeeping": ["view_orders"],
  "/restaurant/spa-bar": ["view_orders", "edit_stock"],
  "/restaurant/spa": ["view_orders", "edit_stock"],
  "/restaurant/bar": ["view_orders", "edit_stock"],
  "/restaurant/events": ["view_orders"],
  "/restaurant/staff": ["add_staff", "view_reports"],
  "/restaurant/commissions": ["view_reports", "add_staff"],
  "/restaurant/tasks-sop": ["activity_tracking", "add_staff"],
  "/restaurant/analytics": ["view_reports"],
  "/restaurant/finance": ["view_wallet", "view_settlements"],
  "/restaurant/corporate-billing": ["view_wallet", "view_reports"],
  "/restaurant/qr-management": ["qr_controls", "nfc_controls"],
  "/restaurant/digital-signage": ["create_campaigns"],
  "/restaurant/kiosk": ["qr_controls", "printer_settings"],
  "/restaurant/documents": ["view_reports", "activity_tracking"],
  "/restaurant/branches": ["branch_wise_access"],
  "/restaurant/ai-features": ["view_reports"],
  "/restaurant/white-label": ["qr_controls"],
  "/restaurant/rbac": ["approval_workflows"],
  "/restaurant/audit": ["activity_tracking"],
  "/restaurant/monitoring": ["activity_tracking"],
  "/restaurant/backup": ["activity_tracking"],
  "/restaurant/notifications": ["send_promotions", "view_orders"],
  "/restaurant/settings": ["printer_settings", "qr_controls"],
  "/restaurant/offline": ["printer_settings"],
  "/restaurant/communications": ["send_promotions", "create_campaigns"],
  "/restaurant/aggregators": ["view_reports"],
  "/restaurant/api-platform": ["activity_tracking"],
  "/restaurant/sandbox": ["view_reports"],
  "/restaurant/accessibility": ["view_reports"],
};

export type RolePermissions = Record<string, Record<string, boolean>>;

export function hasPermission(
  role: string,
  permissions: RolePermissions,
  key: string,
): boolean {
  if (role === "owner" || role === "franchise") return true;
  return Boolean(permissions[role]?.[key]);
}

export function canAccessPath(
  role: string,
  permissions: RolePermissions,
  path: string,
  fallbackPaths?: string[],
): boolean {
  if (role === "owner" || role === "franchise") return true;
  const keys = PATH_PERMISSIONS[path];
  if (keys?.length) {
    return keys.some(k => hasPermission(role, permissions, k));
  }
  return fallbackPaths ? fallbackPaths.includes(path) : false;
}
