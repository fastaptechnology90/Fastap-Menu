import { eq } from "drizzle-orm";
import { db, platformRolesTable } from "@workspace/db";

export type AdminRole =
  | "super_admin"
  | "finance_admin"
  | "support_admin"
  | "compliance_admin"
  | "sales_admin"
  | "operations_admin";

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

const ROLE_DEFAULTS: Record<AdminRole, PermissionKey[]> = {
  super_admin: ["all"],
  finance_admin: ["overview", "finance"],
  support_admin: ["overview", "support", "vendors"],
  compliance_admin: ["overview", "compliance", "vendors"],
  sales_admin: ["overview", "vendors", "communications"],
  operations_admin: ["overview", "operations", "communications"],
};

const ROLE_NAME_MAP: Record<string, AdminRole> = {
  super_admin: "super_admin",
  finance_admin: "finance_admin",
  support_admin: "support_admin",
  compliance_admin: "compliance_admin",
  sales_admin: "sales_admin",
  operations_admin: "operations_admin",
};

/** Route prefix → permission required (GET = view, mutations need same module) */
export const ROUTE_MODULE_MAP: Record<string, PermissionKey> = {
  "/superadmin/app-releases": "platform",
  "/superadmin/stats": "overview",
  "/superadmin/live-feed": "overview",
  "/superadmin/search": "overview",
  "/superadmin/ai-insights": "overview",
  "/superadmin/revenue-leakage": "finance",
  "/superadmin/payments": "finance",
  "/superadmin/refunds": "finance",
  "/superadmin/chargebacks": "finance",
  "/superadmin/settlements": "finance",
  "/superadmin/escrow": "finance",
  "/superadmin/vendor-wallets": "finance",
  "/superadmin/billing": "finance",
  "/superadmin/approvals": "finance",
  "/superadmin/invoices": "finance",
  "/superadmin/commissions": "finance",
  "/superadmin/taxes": "finance",
  "/superadmin/reconciliation": "finance",
  "/superadmin/penalties": "finance",
  "/superadmin/vendors": "vendors",
  // `/superadmin/restaurants/*` does the same work as `/superadmin/vendors/*`
  // (list, enable/disable, change plan). Without this entry it fell through to
  // the "platform" default, so a team member with the vendors module could
  // toggle a restaurant on one route and get 403 on the other (BUG.md #26).
  "/superadmin/restaurants": "vendors",
  "/superadmin/dormant-vendors": "vendors",
  "/superadmin/dormant": "vendors",
  "/superadmin/kyc": "compliance",
  "/superadmin/subscriptions": "vendors",
  "/superadmin/plans": "vendors",
  "/superadmin/coupons": "vendors",
  "/superadmin/agreements": "compliance",
  "/superadmin/vendor-crm": "vendors",
  "/superadmin/documents": "compliance",
  "/superadmin/reservations": "vendors",
  "/superadmin/support": "support",
  "/superadmin/qr-codes": "operations",
  "/superadmin/qr": "operations",
  "/superadmin/fraud": "operations",
  "/superadmin/analytics": "overview",
  "/superadmin/sla": "support",
  "/superadmin/tasks": "support",
  "/superadmin/incidents": "operations",
  "/superadmin/alert-rules": "operations",
  "/superadmin/alerts": "operations",
  "/superadmin/notifications": "communications",
  "/superadmin/communications": "communications",
  "/superadmin/announcements": "communications",
  "/superadmin/audit-logs": "platform",
  "/superadmin/error-logs": "platform",
  "/superadmin/export": "platform",
  "/superadmin/exports": "platform",
  "/superadmin/users": "platform",
  "/superadmin/roles": "platform",
  "/superadmin/security": "platform",
  "/superadmin/infrastructure": "operations",
  "/superadmin/dr-status": "platform",
  "/superadmin/disaster-recovery": "platform",
  "/superadmin/api-keys": "platform",
  "/superadmin/api-usage": "platform",
  "/superadmin/api": "platform",
  "/superadmin/billing-rules": "finance",
  "/superadmin/settlement-rules": "finance",
  "/superadmin/sandbox": "platform",
  "/superadmin/archival": "platform",
  "/superadmin/feature-releases": "platform",
  "/superadmin/legal": "compliance",
  "/superadmin/white-label": "platform",
  "/superadmin/settings": "platform",
  "/superadmin/metrics": "operations",
  "/superadmin/webhooks": "platform",
};

export function normalizeAdminRole(role: string): AdminRole | null {
  return ROLE_NAME_MAP[role] ?? null;
}

export async function resolveAdminPermissions(role: string): Promise<Set<PermissionKey>> {
  const normalized = normalizeAdminRole(role);
  if (!normalized) return new Set();
  if (normalized === "super_admin") return new Set<PermissionKey>(["all"]);

  const defaults = ROLE_DEFAULTS[normalized] ?? ["overview"];
  const perms = new Set<PermissionKey>(defaults);

  const roleLabel = normalized.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const [row] = await db.select().from(platformRolesTable).where(eq(platformRolesTable.name, roleLabel)).limit(1);
  if (row?.permissions && typeof row.permissions === "object") {
    const p = row.permissions as Record<string, boolean>;
    if (p.all) return new Set<PermissionKey>(["all"]);
    if (p.finance || p.refunds || p.payouts) perms.add("finance");
    if (p.support) perms.add("support");
    if (p.vendors) perms.add("vendors");
    if (p.kyc || p.documents) perms.add("compliance");
    if (p.operations) perms.add("operations");
    if (p.communications) perms.add("communications");
  }
  return perms;
}

export function permissionForPath(path: string): PermissionKey {
  const clean = path.replace(/^\/api/, "").split("?")[0];
  const entries = Object.entries(ROUTE_MODULE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, perm] of entries) {
    if (clean.startsWith(prefix)) return perm;
  }
  return "platform";
}

export function hasPermission(perms: Set<PermissionKey>, required: PermissionKey): boolean {
  if (perms.has("all")) return true;
  return perms.has(required);
}

export function canAccessAdminPath(perms: Set<PermissionKey>, adminPath: string): boolean {
  if (perms.has("all")) return true;
  const module = NAV_PATH_PERMISSION[adminPath];
  if (!module) return true;
  return perms.has(module);
}

/** Frontend nav paths → permission */
export const NAV_PATH_PERMISSION: Record<string, PermissionKey> = {
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
  "/app-releases": "platform",
  "/legal": "compliance",
  "/white-label": "platform",
  "/settings": "platform",
};
