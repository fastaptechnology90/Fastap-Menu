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
  /**
   * Some actions are told apart by the payload rather than the path. Cancelling an order
   * and marking it ready are both `PUT /orders/:id`; only the body says which. A rule that
   * carries this applies solely to requests whose body it recognises.
   */
  when?: (body: Record<string, unknown>) => boolean;
};

/** `/restaurants/123/...` — the id varies, the tail is what identifies the action. */
const under = (tail: string) => new RegExp(`^/restaurants/\\d+/${tail}`);

const WRITE = /^(POST|PUT|PATCH|DELETE)$/;
const ANY = /^[A-Z]+$/;

const RULES: Rule[] = [
  // ── Orders ───────────────────────────────────────────────────────────
  { method: ANY, path: under("orders"), permission: "view_orders", action: "view orders" },

  // The three things that take money back off a bill. Each was reachable by anyone who
  // could see an order, because the rule above matched first and this file stopped at the
  // first match — so the `edit_orders` rule that used to sit here was never once consulted.
  // A kitchen account could issue a refund; a waiter could cancel a settled bill and reverse
  // the whole payment out of the ledger. Every rule that matches a request is now checked,
  // and each of these names the permission the RBAC screen already shows against it.
  {
    method: /^POST$/, path: new RegExp("^/restaurants/\\d+/orders/\\d+/refund"),
    permission: "refund_orders", action: "refund an order",
  },
  {
    method: /^POST$/, path: new RegExp("^/restaurants/\\d+/orders/\\d+/(void|comp)-item"),
    permission: "edit_orders", action: "void or comp a line",
  },
  {
    method: /^PUT$/, path: new RegExp("^/restaurants/\\d+/orders/\\d+$"),
    when: b => String(b.status ?? "").toLowerCase() === "cancelled",
    permission: "cancel_orders", action: "cancel an order",
  },
  // Collecting less than the bill says is how a discount is applied at the till, and it is
  // indistinguishable from pocketing the difference unless someone senior signs it off.
  {
    method: /^PUT$/, path: new RegExp("^/restaurants/\\d+/orders/\\d+$"),
    when: b => b.finalTotal !== undefined && b.finalTotal !== null,
    permission: "edit_orders", action: "reprice a bill",
  },

  // ── Day-end readings ─────────────────────────────────────
  // X and Z are the day's whole takings broken down by method, staff and adjustment.
  // Every role could read them, a waiter included.
  { method: /^GET$/, path: under("reports"), permission: "view_reports", action: "read the day-end report" },

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
  // The matrix has always shown an `edit_salary` toggle; nothing held anything against it.
  {
    method: /^(POST|PUT)$/, path: under("staff"),
    when: b => b.salary !== undefined,
    permission: "edit_salary", action: "set a salary",
  },

  // ── Money ────────────────────────────────────────────────────────────
  { method: ANY, path: under("finance"), permission: "view_wallet", action: "view finance" },
  { method: ANY, path: under("settlements"), permission: "view_settlements", action: "view settlements" },
  { method: ANY, path: under("analytics"), permission: "view_reports", action: "view reports" },
  { method: ANY, path: under("revenue"), permission: "view_reports", action: "view revenue" },
  // Corporate accounts carry credit limits and outstanding balances — the same class of
  // figure as the finance ledger, and they answered to every signed-in role.
  { method: ANY, path: under("corporate"), permission: "view_reports", action: "view corporate billing" },

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

  // ── Backups and API credentials ──────────────────────────────
  // A backup is the whole venue's data in one download and an API key grants that same
  // access again from outside; both answered to any staff session. The read side matches
  // what the panel's own navigation already gates these screens on.
  { method: /^GET$/, path: under("backup"), permission: "activity_tracking", action: "view backups" },
  { method: WRITE, path: under("backup"), permission: "__owner_only__", action: "create, restore or delete a backup" },
  { method: /^GET$/, path: under("platform/api-keys"), permission: "activity_tracking", action: "view API keys" },
  { method: WRITE, path: under("platform/api-keys"), permission: "__owner_only__", action: "regenerate API keys" },

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

  // EVERY matching rule has to pass, not just the first one found.
  //
  // This used to stop at the first match, and the rules are ordered general to specific —
  // so `ANY /orders` shadowed every rule after it and the `edit_orders` check sitting
  // behind it was dead code. A waiter could cancel a settled bill and a kitchen account
  // could issue a refund, both on nothing more than `view_orders`. Requiring all of them
  // can only ever refuse more than before, never less, so no route can become newly open.
  const body = (typeof req.body === "object" && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const rules = RULES.filter(r =>
    r.method.test(req.method) && r.path.test(req.path) && (!r.when || r.when(body)),
  );
  if (rules.length === 0) {
    next();
    return;
  }

  const role = String(staff.staffRole ?? "").toLowerCase();
  if (ALWAYS_ALLOWED.has(role)) {
    next();
    return;
  }

  const ownerOnly = rules.find(r => r.permission === "__owner_only__");
  if (ownerOnly) {
    logger.warn(
      { path: req.path, method: req.method, role, staffId: staff.staffId },
      "staff attempted an owner-only action",
    );
    res.status(403).json({ error: `Only the owner can ${ownerOnly.action}.` });
    return;
  }

  const matrix = await permissionsFor(staff.restaurantId);
  const refused = rules.find(r => !matrix[role]?.[r.permission]);
  if (!refused) {
    next();
    return;
  }

  logger.warn(
    { path: req.path, method: req.method, role, permission: refused.permission, staffId: staff.staffId },
    "staff permission refused",
  );
  res.status(403).json({ error: `Your role does not allow you to ${refused.action}.` });
}
