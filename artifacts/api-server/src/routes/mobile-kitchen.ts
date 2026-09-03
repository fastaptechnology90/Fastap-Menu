import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, staffTable } from "@workspace/db";
import {
  requireMobileAuth,
  mobileSession,
  sessionPayload,
  revokeMobileSession,
  revokeAllMobileSessions,
  type MobileSession,
} from "../lib/mobile-kitchen/session.js";
import {
  loginWithPassword,
  loginWithPin,
  loginWithQr,
  loginWithBiometric,
  requestOtp,
  verifyOtp,
  loginResponse,
  sessionResponse,
} from "../lib/mobile-kitchen/staff-auth.js";
import {
  getDashboard,
  getKds,
  getProcessing,
  getLiveAlerts,
  applyKdsAction,
  reassignKdsSection,
} from "../lib/mobile-kitchen/kitchen-orders.js";
import { resolveModuleGet } from "../lib/mobile-kitchen/module-snapshots.js";
import { handleMobilePost } from "../lib/mobile-kitchen/mobile-actions.js";
import { systemNumberForApiPath } from "../lib/feature-modules/catalog.js";
import {
  getEnabledSystemNumbers,
  isSystemEnabled,
  mobileFeaturesPayload,
  resolveFeatureEntitlements,
  filterPermissionsByEntitlements,
} from "../lib/feature-modules/entitlements.js";
import { permissionsForRole } from "../lib/mobile-kitchen/permissions.js";

const router: IRouter = Router();

async function gateModuleAccess(
  req: Request,
  res: Response,
  apiPath: string,
): Promise<boolean> {
  const systemNumber = systemNumberForApiPath(apiPath);
  if (systemNumber == null || systemNumber === 1) return true;
  const s = mobileSession(req);
  const enabled = await getEnabledSystemNumbers(s.restaurantId);
  if (isSystemEnabled(enabled, systemNumber)) return true;
  res.status(403).json({
    message: `Module ${systemNumber} is not enabled for this restaurant`,
    code: "MODULE_DISABLED",
    systemNumber,
  });
  return false;
}

function authError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "Request failed";
  const map: Record<string, { status: number; message: string; code?: string }> = {
    INVALID_CREDENTIALS: { status: 401, message: "Invalid staff code or password" },
    INVALID_OTP: { status: 401, message: "Invalid or expired OTP" },
    PHONE_NOT_FOUND: { status: 404, message: "Mobile number not registered" },
    STAFF_INACTIVE: { status: 403, message: "Staff account is inactive" },
    RESTAURANT_INACTIVE: { status: 403, message: "Restaurant is not active" },
    PASSWORD_NOT_SET: { status: 401, message: "Password not set. Contact your manager." },
    ROLE_MISMATCH: { status: 403, message: "Selected role does not match staff profile", code: "ROLE_MISMATCH" },
    BIOMETRIC_REQUIRED: { status: 403, message: "Complete device biometric verification first" },
    MISSING_FIELDS: { status: 400, message: "Missing required fields" },
  };
  const hit = map[msg] ?? { status: 400, message: msg };
  res.status(hit.status).json({ message: hit.message, code: hit.code });
}

async function authPost(
  handler: (body: Record<string, unknown>) => Promise<MobileSession>,
  req: Request,
  res: Response,
) {
  try {
    res.json(loginResponse(await handler(req.body ?? {})));
  } catch (err) {
    authError(res, err);
  }
}

router.post("/auth/register", async (req, res) => {
  res.json({
    success: true,
    message: "Registration submitted. Ask your restaurant manager to create your staff account in the admin panel.",
    role: req.body?.role,
  });
});

router.post("/auth/otp/request", async (req, res) => {
  try {
    res.json(await requestOtp(String(req.body?.phone ?? "")));
  } catch (err) {
    authError(res, err);
  }
});

router.post("/auth/otp/verify", (req, res) => authPost(verifyOtp, req, res));
router.post("/auth/pin", (req, res) => authPost(loginWithPin, req, res));
router.post("/auth/password", (req, res) => authPost(loginWithPassword, req, res));
router.post("/auth/qr/verify", (req, res) => authPost(loginWithQr, req, res));
router.post("/auth/biometric", (req, res) => authPost(loginWithBiometric, req, res));

router.post("/auth/logout", requireMobileAuth, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  revokeMobileSession(token);
  res.json({ success: true });
});

router.post("/auth/emergency-logout", requireMobileAuth, (_req, res) => {
  revokeAllMobileSessions();
  res.json({ success: true });
});

router.get("/auth/session", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const enabled = await getEnabledSystemNumbers(s.restaurantId);
  s.permissions = filterPermissionsByEntitlements(
    permissionsForRole(s.user.role),
    enabled,
  );
  res.json(sessionResponse(s));
});

router.get("/auth/permissions", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const enabled = await getEnabledSystemNumbers(s.restaurantId);
  s.permissions = filterPermissionsByEntitlements(
    permissionsForRole(s.user.role),
    enabled,
  );
  res.json({ permissions: s.permissions });
});

router.get("/features", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const resolved = await resolveFeatureEntitlements(s.restaurantId);
  res.json(
    mobileFeaturesPayload(s.restaurantId, resolved.enabledSystemNumbers, resolved.plan),
  );
});

router.get("/auth/shift/current", requireMobileAuth, (req, res) => {
  const s = mobileSession(req);
  const started = new Date(Date.now() - 2 * 3600_000);
  const ends = new Date(Date.now() + 6 * 3600_000);
  res.json({
    shift: {
      id: s.shiftId,
      startedAt: started.toISOString(),
      endsAt: ends.toISOString(),
      role: s.user.role,
      section: s.user.section,
      status: "active",
    },
  });
});

router.post("/auth/device/bind", requireMobileAuth, (req, res) => {
  const s = mobileSession(req);
  s.deviceId = String(req.body?.deviceId ?? s.deviceId);
  res.json({ success: true, message: "Device bound successfully" });
});

router.post("/auth/activity", requireMobileAuth, (_req, res) => {
  res.json({ success: true, lastActivityAt: new Date().toISOString() });
});

router.post("/auth/profile", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const patch: Record<string, unknown> = {};
  if (req.body?.name) patch.name = String(req.body.name);
  if (req.body?.phone) patch.phone = String(req.body.phone);
  if (Object.keys(patch).length) {
    await db.update(staffTable).set(patch).where(eq(staffTable.id, s.staffId));
    if (patch.name) s.user.name = String(patch.name);
    if (patch.phone) s.user.phone = String(patch.phone);
  }
  res.json({ session: sessionPayload(s) });
});

router.post("/auth/profile/email", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, s.staffId)).limit(1);
  if (!staff?.pinHash || !(await bcrypt.compare(password, staff.pinHash))) {
    res.status(401).json({ message: "Invalid password" });
    return;
  }
  await db.update(staffTable).set({ email }).where(eq(staffTable.id, s.staffId));
  s.user.email = email;
  res.json({ session: sessionPayload(s) });
});

router.post("/auth/profile/password", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const current = String(req.body?.currentPassword ?? "");
  const next = String(req.body?.newPassword ?? "");
  if (next.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, s.staffId)).limit(1);
  if (!staff?.pinHash || !(await bcrypt.compare(current, staff.pinHash))) {
    res.status(401).json({ message: "Current password is incorrect" });
    return;
  }
  const pinHash = await bcrypt.hash(next, 10);
  await db.update(staffTable).set({ pinHash }).where(eq(staffTable.id, s.staffId));
  res.json({ success: true });
});

router.post("/auth/profile/delete", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const password = String(req.body?.password ?? "");
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, s.staffId)).limit(1);
  if (!staff?.pinHash || !(await bcrypt.compare(password, staff.pinHash))) {
    res.status(401).json({ message: "Invalid password" });
    return;
  }
  await db.update(staffTable).set({ isActive: false, status: "inactive" }).where(eq(staffTable.id, s.staffId));
  revokeMobileSession(s.token);
  res.json({ success: true });
});

router.get("/dashboard", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/dashboard"))) return;
  const s = mobileSession(req);
  const section = String(req.query.section ?? "All");
  res.json({ success: true, data: await getDashboard(s.restaurantId, section, { role: s.user.role, name: s.user.name }) });
});

router.get("/dashboard/widgets", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const section = String(req.query.section ?? "All");
  const payload = await resolveModuleGet("/dashboard/widgets", section, s.restaurantId, req.query as Record<string, string>);
  res.json(payload);
});

router.get("/dashboard/metrics", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const section = String(req.query.section ?? "All");
  res.json(await resolveModuleGet("/dashboard/metrics", section, s.restaurantId, req.query as Record<string, string>));
});

router.get("/dashboard/orders", requireMobileAuth, async (req, res) => {
  const s = mobileSession(req);
  const section = String(req.query.section ?? "All");
  res.json(await resolveModuleGet("/dashboard/orders", section, s.restaurantId, req.query as Record<string, string>));
});

router.get("/kds", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/kds"))) return;
  const s = mobileSession(req);
  res.json({
    success: true,
    data: await getKds(
      s.restaurantId,
      String(req.query.section ?? "All"),
      String(req.query.view ?? "queue"),
      String(req.query.filter ?? "all"),
    ),
  });
});

router.post("/kds/orders/:orderId/action", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/kds"))) return;
  const s = mobileSession(req);
  try {
    const order = await applyKdsAction(s.restaurantId, req.params.orderId, String(req.body?.action ?? ""));
    res.json({ success: true, order });
  } catch {
    res.status(404).json({ message: "Order not found" });
  }
});

router.post("/kds/reorder", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/kds"))) return;
  res.json({ success: true });
});

router.post("/orders/:orderId/process", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/orders/processing"))) return;
  const s = mobileSession(req);
  const action = String(req.body?.action ?? "");
  try {
    const order = action === "reassign"
      ? await reassignKdsSection(s.restaurantId, req.params.orderId, String(req.body?.targetSection ?? ""))
      : await applyKdsAction(s.restaurantId, req.params.orderId, action);
    res.json({ success: true, order });
  } catch {
    res.status(404).json({ message: "Order not found" });
  }
});

router.get("/orders/processing", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/orders/processing"))) return;
  const s = mobileSession(req);
  res.json({ success: true, data: await getProcessing(s.restaurantId, String(req.query.section ?? "All")) });
});

router.get("/live-alerts/board", requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, "/live-alerts/board"))) return;
  const s = mobileSession(req);
  res.json({ success: true, data: await getLiveAlerts(s.restaurantId, String(req.query.section ?? "All")) });
});

router.get(/.*/, requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, req.path))) return;
  const s = mobileSession(req);
  const section = String(req.query.section ?? "All");
  const data = await resolveModuleGet(req.path, section, s.restaurantId, req.query as Record<string, string>);
  if (req.path.startsWith("/dashboard/")) {
    res.json(data);
    return;
  }
  res.json({ success: true, data });
});

router.post(/.*/, requireMobileAuth, async (req, res) => {
  if (!(await gateModuleAccess(req, res, req.path))) return;
  const s = mobileSession(req);
  try {
    const handled = await handleMobilePost(
      req.path,
      (req.body ?? {}) as Record<string, unknown>,
      s,
    );
    if (handled) {
      res.json(handled);
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed";
    const status = msg.endsWith("_NOT_FOUND") ? 404 : msg === "UNKNOWN_ACTION" ? 400 : 500;
    res.status(status).json({ success: false, message: msg.replace(/_/g, " ").toLowerCase() });
    return;
  }

  const action = String(req.body?.action ?? "");
  if (req.path.includes("/optimize") || req.path.includes("/sync") || req.path.includes("/allocate")) {
    res.json({ success: true, message: "Operation completed", movedOrders: 0 });
    return;
  }
  if (req.path.includes("/action")) {
    res.json({ success: true, message: action ? `${action} recorded` : "Action recorded" });
    return;
  }
  if (req.path.includes("/ai/assistant/apply")) {
    res.json({ success: true, message: "AI suggestion applied" });
    return;
  }
  if (req.path.includes("/trigger-panic")) {
    res.json({ success: true, message: "Panic protocol activated" });
    return;
  }
  res.json({ success: true, message: "OK" });
});

export default router;
