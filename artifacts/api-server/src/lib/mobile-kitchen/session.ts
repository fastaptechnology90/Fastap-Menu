import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Staff } from "@workspace/db";
import { makeDeviceToken } from "./staff-tokens.js";

export type MobileSession = {
  token: string;
  staffId: number;
  restaurantId: number;
  deviceId: string;
  loginMethod: string;
  expiresAt: string;
  user: {
    id: string;
    name: string;
    role: string;
    section: string;
    phone: string;
    staffCode: string;
    email: string;
  };
  permissions: string[];
  shiftId: string;
  geoVerified: boolean;
  /** Long-lived, signed proof this handset was granted a session — enables biometric unlock. */
  deviceToken: string;
};

const sessions = new Map<string, MobileSession>();

export function staffCodeFor(id: number) {
  return `KCH-${String(id).padStart(3, "0")}`;
}

export function createMobileSession(
  staff: Staff,
  deviceId: string,
  loginMethod: string,
  permissions: string[],
  role: string,
  section: string,
): MobileSession {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 3600_000).toISOString();
  const session: MobileSession = {
    token,
    staffId: staff.id,
    restaurantId: staff.restaurantId,
    deviceId,
    loginMethod,
    expiresAt,
    user: {
      id: `STF-${staff.id}`,
      name: staff.name,
      role,
      section,
      phone: staff.phone ?? "",
      staffCode: staffCodeFor(staff.id),
      email: staff.email,
    },
    permissions,
    shiftId: `SHIFT-${new Date().toISOString().slice(0, 13).replace(/[-:T]/g, "")}`,
    geoVerified: true,
    deviceToken: makeDeviceToken(staff.id, deviceId),
  };
  sessions.set(token, session);
  return session;
}

export function sessionPayload(session: MobileSession) {
  return {
    token: session.token,
    user: session.user,
    expiresAt: session.expiresAt,
    deviceId: session.deviceId,
    shiftId: session.shiftId,
    permissions: session.permissions,
    loginMethod: session.loginMethod,
    geoVerified: session.geoVerified,
    // Store this alongside the session. Offering biometric unlock on the next launch
    // means replaying it — the fingerprint guards the app's storage, this proves the
    // server already granted this handset a session for this staff member.
    deviceToken: session.deviceToken,
  };
}

export function getMobileSession(token?: string | null) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function revokeMobileSession(token?: string | null) {
  if (token) sessions.delete(token);
}

/**
 * "Emergency logout" on a handset means "sign me out of every device I am on" — the
 * phone was lost, or handed to the next shift. It used to clear the whole map, so one
 * line cook tapping it signed out every staff member at every restaurant on the
 * platform, mid-service, with no way to tell what had happened.
 */
export function revokeStaffMobileSessions(staffId: number) {
  let revoked = 0;
  for (const [token, session] of sessions) {
    if (session.staffId === staffId) {
      sessions.delete(token);
      revoked++;
    }
  }
  return revoked;
}

export function requireMobileAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = getMobileSession(token);
  if (!session) {
    res.status(401).json({ message: "Session expired. Please sign in again.", code: "SESSION_EXPIRED" });
    return;
  }
  (req as Request & { mobileSession: MobileSession }).mobileSession = session;
  next();
}

export function mobileSession(req: Request) {
  return (req as Request & { mobileSession?: MobileSession }).mobileSession!;
}
