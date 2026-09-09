import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { db, mobileSessionsTable, type Staff } from "@workspace/db";
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

/**
 * A read cache in front of `mobile_sessions`.
 *
 * Sessions used to live only here. A Map dies with the process, so every deploy and every
 * crash signed out the kitchen display and every waiter handheld mid-service — and the
 * login rate limit then locked them out again when they all signed back in at once. The
 * database is now the record; this only saves a query on the hot path.
 */
const sessions = new Map<string, MobileSession>();

async function persistSession(session: MobileSession): Promise<void> {
  try {
    await db.insert(mobileSessionsTable).values({
      token: session.token,
      staffId: session.staffId,
      restaurantId: session.restaurantId,
      expiresAt: new Date(session.expiresAt),
      session,
    }).onConflictDoNothing();
    // Expired rows are dead weight; clear them out whenever a new one is written.
    await db.delete(mobileSessionsTable).where(lt(mobileSessionsTable.expiresAt, new Date()));
  } catch (e) {
    // A session that cannot be persisted still works until the next restart. Failing the
    // sign-in over it would be worse than losing it on a deploy.
    console.error("mobile session persist failed", e);
  }
}

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

/** Called by createMobileSession's callers so the handset survives a restart. */
export async function saveMobileSession(session: MobileSession): Promise<MobileSession> {
  await persistSession(session);
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

export async function getMobileSession(token?: string | null): Promise<MobileSession | null> {
  if (!token) return null;

  let session = sessions.get(token) ?? null;
  if (!session) {
    // Not in this process's cache: either the server restarted, or the handset last
    // spoke to a different one. Either way the session is still real.
    try {
      const [row] = await db.select().from(mobileSessionsTable)
        .where(eq(mobileSessionsTable.token, token)).limit(1);
      if (row) {
        session = row.session as MobileSession;
        sessions.set(token, session);
      }
    } catch (e) {
      console.error("mobile session lookup failed", e);
    }
  }
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.delete(token);
    await db.delete(mobileSessionsTable).where(eq(mobileSessionsTable.token, token)).catch(() => {});
    return null;
  }
  return session;
}

export async function revokeMobileSession(token?: string | null): Promise<void> {
  if (!token) return;
  sessions.delete(token);
  await db.delete(mobileSessionsTable).where(eq(mobileSessionsTable.token, token)).catch(() => {});
}

/**
 * "Emergency logout" on a handset means "sign me out of every device I am on" — the
 * phone was lost, or handed to the next shift. It used to clear the whole map, so one
 * line cook tapping it signed out every staff member at every restaurant on the
 * platform, mid-service, with no way to tell what had happened.
 */
export async function revokeStaffMobileSessions(staffId: number): Promise<number> {
  let revoked = 0;
  for (const [token, session] of sessions) {
    if (session.staffId === staffId) {
      sessions.delete(token);
      revoked++;
    }
  }
  const removed = await db.delete(mobileSessionsTable)
    .where(eq(mobileSessionsTable.staffId, staffId)).returning({ token: mobileSessionsTable.token })
    .catch(() => [] as { token: string }[]);
  return Math.max(revoked, removed.length);
}

export async function requireMobileAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = await getMobileSession(token);
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
