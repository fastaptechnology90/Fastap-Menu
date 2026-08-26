import { adminNavGroups, type AdminNavGroup } from "@/config/adminNav";

export type PermissionKey =
  | "all"
  | "overview"
  | "finance"
  | "vendors"
  | "support"
  | "compliance"
  | "operations"
  | "communications"
  | "platform";

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: ["all"],
  finance_admin: ["overview", "finance"],
  support_admin: ["overview", "support", "vendors"],
  compliance_admin: ["overview", "compliance", "vendors"],
  sales_admin: ["overview", "vendors", "communications"],
  operations_admin: ["overview", "operations", "communications"],
};

// Roles the admin can manage on the Roles & Permissions page. super_admin always has full
// access and isn't editable.
export const MANAGEABLE_ADMIN_ROLES = [
  "finance_admin",
  "support_admin",
  "compliance_admin",
  "sales_admin",
  "operations_admin",
];

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
  compliance_admin: "Compliance Admin",
  sales_admin: "Sales Admin",
  operations_admin: "Operations Admin",
};

export const NAV_PATH_PERMISSION: Record<string, PermissionKey> = {
  "/dashboard": "overview",
  "/live-monitoring": "overview",
  "/search": "overview",
  "/ai-insights": "overview",
  "/revenue-leakage": "finance",
  "/restaurant-revenues": "overview",
  "/payments": "finance",
  "/refunds": "finance",
  "/chargebacks": "finance",
  "/settlements": "finance",
  "/escrow": "finance",
  "/vendor-wallets": "finance",
  "/billing-engine": "finance",
  "/approvals": "finance",
  "/invoices": "finance",
  "/commissions": "finance",
  "/taxes": "finance",
  "/reconciliation": "finance",
  "/penalties": "finance",
  "/vendors": "vendors",
  "/dormant-vendors": "vendors",
  "/kyc": "compliance",
  "/subscriptions": "vendors",
  "/plans": "vendors",
  "/coupons": "vendors",
  "/agreements": "compliance",
  "/vendor-crm": "vendors",
  "/document-vault": "compliance",
  "/reservations": "vendors",
  "/support": "support",
  "/qr-nfc": "operations",
  "/fraud": "operations",
  "/analytics": "overview",
  "/sla-monitoring": "support",
  "/tasks": "support",
  "/incidents": "operations",
  "/alert-engine": "operations",
  "/notifications": "communications",
  "/communications": "communications",
  "/announcements": "communications",
  "/blog": "communications",
  "/audit-logs": "platform",
  "/error-logs": "platform",
  "/export-center": "platform",
  "/users": "platform",
  "/roles": "platform",
  "/security": "platform",
  "/infrastructure": "operations",
  "/disaster-recovery": "platform",
  "/api-control": "platform",
  "/sandbox": "platform",
  "/data-archival": "platform",
  "/feature-releases": "platform",
  "/legal": "compliance",
  "/white-label": "platform",
  "/settings": "platform",
};

// Per-role explicit allow-list of page paths, loaded from the saved config on the
// Roles & Permissions page. When set for a role, it overrides the group-based defaults.
let pageOverrides: Record<string, string[]> | null = null;
export function setAdminPageOverrides(cfg: Record<string, string[]> | null) {
  pageOverrides = cfg;
}
export function getAdminPageOverrides(): Record<string, string[]> | null {
  return pageOverrides;
}

// The pages a role gets by default (derived from its permission groups). Used to seed the
// toggles on the Roles & Permissions page.
export function defaultRolePages(role: string): string[] {
  const perms = new Set(ROLE_PERMISSIONS[role] ?? ["overview"]);
  const all = adminNavGroups.flatMap(g => g.items.map(i => i.href));
  if (perms.has("all")) return all;
  return all.filter(href => perms.has(NAV_PATH_PERMISSION[href] ?? "overview"));
}

function allowedPages(role: string, extraPerms?: PermissionKey[]): Set<string> {
  // A saved override for the role is the source of truth — it wins over the role's default
  // group permissions (which the login response carries as extraPerms for every admin).
  // Super admins never reach here (they short-circuit on the "all" perm above).
  if (pageOverrides && pageOverrides[role]) {
    return new Set(pageOverrides[role]);
  }
  const perms = new Set(extraPerms?.length ? extraPerms : (ROLE_PERMISSIONS[role] ?? ["overview"]));
  const all = adminNavGroups.flatMap(g => g.items.map(i => i.href));
  if (perms.has("all")) return new Set(all);
  return new Set(all.filter(href => perms.has(NAV_PATH_PERMISSION[href] ?? "overview")));
}

export function canAccessAdminPath(role: string, path: string, extraPerms?: PermissionKey[]): boolean {
  const perms = new Set(extraPerms?.length ? extraPerms : (ROLE_PERMISSIONS[role] ?? ["overview"]));
  if (perms.has("all")) return true;
  const base = path.split("?")[0];
  const allowed = allowedPages(role, extraPerms);
  if (base.startsWith("/vendors/")) return allowed.has("/vendors");
  if (!(base in NAV_PATH_PERMISSION)) return true; // unmapped helper routes stay open
  return allowed.has(base);
}

export function filterAdminNav(role: string, extraPerms?: PermissionKey[]): AdminNavGroup[] {
  const perms = new Set<PermissionKey>(extraPerms?.length ? extraPerms : (ROLE_PERMISSIONS[role] ?? ["overview"]));
  if (perms.has("all")) return adminNavGroups;
  const allowed = allowedPages(role, extraPerms);
  return adminNavGroups
    .map(group => ({ ...group, items: group.items.filter(item => allowed.has(item.href)) }))
    .filter(group => group.items.length > 0);
}
