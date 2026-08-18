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

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  super_admin: ["all"],
  finance_admin: ["overview", "finance"],
  support_admin: ["overview", "support", "vendors"],
  compliance_admin: ["overview", "compliance", "vendors"],
  sales_admin: ["overview", "vendors", "communications"],
  operations_admin: ["overview", "operations", "communications"],
};

const NAV_PATH_PERMISSION: Record<string, PermissionKey> = {
  "/dashboard": "overview",
  "/live-monitoring": "overview",
  "/search": "overview",
  "/ai-insights": "overview",
  "/revenue-leakage": "finance",
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

function permSet(role: string, extra?: PermissionKey[]): Set<PermissionKey> {
  if (extra?.length) return new Set(extra);
  const base = ROLE_PERMISSIONS[role] ?? ["overview"];
  return new Set(base);
}

export function canAccessAdminPath(role: string, path: string, extraPerms?: PermissionKey[]): boolean {
  const perms = permSet(role, extraPerms as PermissionKey[] | undefined);
  if (perms.has("all")) return true;
  const base = path.split("?")[0];
  if (base.startsWith("/vendors/")) return perms.has("vendors");
  const required = NAV_PATH_PERMISSION[base];
  if (!required) return true;
  return perms.has(required);
}

export function filterAdminNav(role: string, extraPerms?: PermissionKey[]): AdminNavGroup[] {
  const perms = permSet(role, extraPerms);
  if (perms.has("all")) return adminNavGroups;
  return adminNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const required = NAV_PATH_PERMISSION[item.href] ?? "overview";
        return perms.has(required);
      }),
    }))
    .filter(group => group.items.length > 0);
}
