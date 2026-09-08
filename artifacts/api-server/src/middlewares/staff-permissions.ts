import { type Request, type Response, type NextFunction } from "express";
import { getSettingsSection } from "../lib/restaurant-settings.js";
import { DEFAULT_PERMISSIONS } from "../lib/staff-permission-defaults.js";
import { logger } from "../lib/logger.js";

/**
 * Enforce a restaurant's own permission matrix on the server.
 *
 * The gap this closes
 * -------------------
 * The panel has a full 13-role by 25-permission grid that an owner can edit, and it was
 * decoration: `requireAuth` asked only whether someone was signed in, and `PermissionGate`
 * hid buttons in the browser. A waiter's session could delete staff, reprice the menu,
 * read the finance ledger and rewrite the permission grid itself — by calling the
 * endpoint directly. Cross-*restaurant* access was already closed (`tenant-scope.ts`);
 * this is separation *within* one venue.
 *
 * How it decides
 * --------------
 * A rule matches a method and a path, and names the permission required. Anything with
 * no rule falls through to `requireAuth` as before — this middleware only ever *adds*
 * a check, so an unmapped route cannot become accidentally unreachable.
 *
 * The matrix comes from the restaurant's own settings, falling back to the defaults the
 * RBAC screen ships with, so an owner who has customised roles gets what they configured.
 */

type Rule = {
  method: RegExp;
  path: RegExp;
  permission: string;
  /** What the user was trying to do, for the refusal message. */
  action: string;
};

/** `/restaurants/123/...` — the id varies, the tail is what identifies the action. */
const under = (tail: string) => new RegExp(`^/restaurants/\\d+/${tail}`);

const WRITE = /^(POST|PUT|PATCH|DELETE)$/;
const ANY = /^[A-Z]+$/;

const RULES: Rule[] = [
  // ── Orders ───────────────────────────────────────────────────────────
  { method: ANY, path: under("orders"), permission: "view_orders", action: "view orders" },
  { method: WRITE, path: under("orders"), permission: "edit_orders", action: "change an order" },

  // ── Menu ─────────────────────────────────────────────────────────────
  { method: /^POST$/, path: under("items"), permission: "add_menu", action: "add a menu item" },
  { method: /^PUT$/, path: under("items"), permission: "edit_pricing", action: "edit a menu item" },
  { method: /^DELETE$/, path: under("items"), permission: "delete_menu", action: "delete a menu item" },
  { method: /^POST$/, path: under("categories"), permission: "add_menu", action: "add a category" },
  { method: /^PUT$/, path: under("categories"), permission: "add_menu", action: "edit a category" },
  { method: /^DELETE$/, path: under("categories"), permission: "delete_menu", action: "delete a category" },

  // ── Staff ────────────────────────────────────────────────────────────
  { method: /^POST$/, path: under("staff"), permission: "add_staff", action: "add a staff member" },
  { method: /^PUT$/, path: under("staff"), permission: "add_staff", action: "edit a staff member" },
  { method: /^DELETE$/, path: under("staff"), permission: "remove_staff", action: "remove a staff member" },

  // ── Money ────────────────────────────────────────────────────────────
  { method: ANY, path: under("finance"), permission: "view_wallet", action: "view finance" },
  { method: ANY, path: under("settlements"), permission: "view_settlements", action: "view settlements" },
  { method: ANY, path: under("analytics"), permission: "view_reports", action: "view reports" },
  { method: ANY, path: under("revenue"), permission: "view_reports", action: "view revenue" },

  // ── Stock and purchasing ─────────────────────────────────────────────
  { method: WRITE, path: under("inventory"), permission: "edit_stock", action: "change stock" },
  { method: WRITE, path: under("purchase-orders"), permission: "approve_purchase", action: "change a purchase order" },
  { method: WRITE, path: under("suppliers"), permission: "approve_purchase", action: "change a supplier" },

  // ── Marketing ────────────────────────────────────────────────────────
  { method: WRITE, path: under("campaigns"), permission: "create_campaigns", action: "change a campaign" },
  { method: WRITE, path: under("promo-codes"), permission: "send_promotions", action: "change a coupon" },

  // ── Settings and hardware ────────────────────────────────────────────
  { method: WRITE, path: under("qrcodes"), permission: "qr_controls", action: "change QR codes" },
  { method: WRITE, path: under("hardware"), permission: "printer_settings", action: "change hardware" },

  // ── The permission grid itself ───────────────────────────────────────
  // Anyone able to edit this could grant themselves everything else, so it is the one
  // place that must be owner-only rather than permission-driven.
  { method: WRITE, path: under("rbac"), permission: "__owner_only__", action: "change permissions" },
  { method: WRITE, path: under("settings/white-label"), permission: "__owner_only__", action: "change white-label settings" },
];

/** Roles that always pass, whatever the matrix says. */
const ALWAYS_ALLOWED = new Set(["owner", "franchise"]);

async function permissionsFor(restaurantId: number): Promise<Record<string, Record<string, boolean>>> {
  const stored = await getSettingsSection<Record<string, Record<string, boolean>> | null>(
    restaurantId,
    "rbac",
    null,
  );
  // Merge rather than replace: a stored matrix that predates a new permission key should
  // still fall back to the default for that key instead of denying it outright.
  if (stored && Object.keys(stored).length > 0) {
    const merged: Record<string, Record<string, boolean>> = {};
    for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      merged[role] = { ...perms, ...(stored[role] ?? {}) };
    }
    for (const [role, perms] of Object.entries(stored)) {
      if (!merged[role]) merged[role] = perms;
    }
    return merged;
  }
  return DEFAULT_PERMISSIONS;
}

export async function requireStaffPermission(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const staff = req.session.staffSession;

  // Not a staff session: super admin and the owner's platform account are handled by
  // their own guards, and public routes never reach here.
  if (!staff || req.session.userId) {
    next();
    return;
  }

  const rule = RULES.find(r => r.method.test(req.method) && r.path.test(req.path));
  if (!rule) {
    next();
    return;
  }

  const role = String(staff.staffRole ?? "").toLowerCase();
  if (ALWAYS_ALLOWED.has(role)) {
    next();
    return;
  }

  if (rule.permission === "__owner_only__") {
    logger.warn(
      { path: req.path, method: req.method, role, staffId: staff.staffId },
      "staff attempted an owner-only action",
    );
    res.status(403).json({ error: `Only the owner can ${rule.action}.` });
    return;
  }

  const matrix = await permissionsFor(staff.restaurantId);
  if (matrix[role]?.[rule.permission]) {
    next();
    return;
  }

  logger.warn(
    { path: req.path, method: req.method, role, permission: rule.permission, staffId: staff.staffId },
    "staff permission refused",
  );
  res.status(403).json({ error: `Your role does not allow you to ${rule.action}.` });
}
