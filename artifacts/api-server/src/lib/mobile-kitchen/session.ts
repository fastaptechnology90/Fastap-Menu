import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { Staff } from "@workspace/db";

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

export function revokeAllMobileSessions() {
  sessions.clear();
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
