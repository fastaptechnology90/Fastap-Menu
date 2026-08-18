import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  hasPermission,
  permissionForPath,
  resolveAdminPermissions,
  type PermissionKey,
} from "../lib/admin-rbac.js";

const SUPER_ADMIN_ROLES = new Set(["super_admin", "finance_admin", "support_admin", "compliance_admin", "sales_admin", "operations_admin"]);

export type AdminRequest = Request & {
  adminUser?: typeof usersTable.$inferSelect;
  adminPermissions?: Set<PermissionKey>;
};

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Super admin access required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user || !SUPER_ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  const ar = req as AdminRequest;
  ar.adminUser = user;
  ar.adminPermissions = await resolveAdminPermissions(user.role);

  const apiPath = req.baseUrl + req.path;
  const required = permissionForPath(apiPath);
  if (!hasPermission(ar.adminPermissions, required)) {
    res.status(403).json({ error: `Access denied: ${required} module required` });
    return;
  }
  next();
}
