import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.userId || req.session.staffSession) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}

// The super-admin guard lives in `./superadmin-auth.ts` — it verifies the user's
// role against SUPER_ADMIN_ROLES and checks per-module permissions.
//
// A second, role-blind copy used to live here: it only asked "is anyone signed in?"
// and never looked at the role. Nothing imported it, but the name was identical, so
// one autocomplete away sat a guard that would have opened the entire admin surface
// to any logged-in restaurant owner (BUG.md #19).
//
// Re-exporting the real one closes that off for good. Importing `requireSuperAdmin`
// from this file now gives the guard that actually checks the role, so the mistake
// is no longer possible to make.
export { requireSuperAdmin } from "./superadmin-auth.js";
