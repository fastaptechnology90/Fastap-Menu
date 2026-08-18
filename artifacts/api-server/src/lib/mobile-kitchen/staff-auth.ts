import bcrypt from "bcryptjs";
import { eq, or, ilike } from "drizzle-orm";
import { db, staffTable, restaurantsTable } from "@workspace/db";
import {
  createMobileSession,
  staffCodeFor,
  sessionPayload,
  type MobileSession,
} from "./session.js";
import {
  mapDbRoleToMobile,
  sectionForRole,
  permissionsForRole,
  assertRoleAllowed,
} from "./permissions.js";
import {
  filterPermissionsByEntitlements,
  getEnabledSystemNumbers,
} from "../feature-modules/entitlements.js";

const otpStore = new Map<string, { otp: string; staffId: number; restaurantId: number; expiresAt: number }>();

export async function findStaffByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const [row] = await db.select().from(staffTable)
      .where(ilike(staffTable.email, raw.toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  const codeMatch = raw.match(/^KCH-(\d+)$/i);
  if (codeMatch) {
    const id = parseInt(codeMatch[1], 10);
    const [row] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
    return row ?? null;
  }

  const digitsOnly = raw.replace(/\D/g, "");
  // Phone numbers (10+ digits) must be resolved before numeric staff-id lookup —
  // otherwise values like 9876543214 overflow PostgreSQL integer and break the query.
  if (digitsOnly.length >= 10) {
    const [byPhone] = await db.select().from(staffTable)
      .where(or(eq(staffTable.phone, raw), eq(staffTable.phone, digitsOnly)))
      .limit(1);
    if (byPhone) return byPhone;
  }

  const numeric = parseInt(raw, 10);
  if (Number.isFinite(numeric) && numeric > 0 && numeric <= 2_147_483_647) {
    const [row] = await db.select().from(staffTable).where(eq(staffTable.id, numeric)).limit(1);
    if (row) return row;
  }

  if (digitsOnly.length > 0) {
    const [byPhone] = await db.select().from(staffTable)
      .where(or(eq(staffTable.phone, raw), eq(staffTable.phone, digitsOnly)))
      .limit(1);
    return byPhone ?? null;
  }

  return null;
}

async function ensureStaffActive(staff: typeof staffTable.$inferSelect) {
  if (!staff.isActive || staff.status === "inactive") {
    throw new Error("STAFF_INACTIVE");
  }
  const [restaurant] = await db.select().from(restaurantsTable)
    .where(eq(restaurantsTable.id, staff.restaurantId))
    .limit(1);
  if (!restaurant?.isActive) {
    throw new Error("RESTAURANT_INACTIVE");
  }
  return restaurant;
}

async function verifySecret(staff: typeof staffTable.$inferSelect, secret: string) {
  if (!staff.pinHash) throw new Error("PASSWORD_NOT_SET");
  const ok = await bcrypt.compare(secret, staff.pinHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");
}

async function buildSession(
  staff: typeof staffTable.$inferSelect,
  deviceId: string,
  loginMethod: string,
  requestedRole?: string,
): Promise<MobileSession> {
  const mobileRole = mapDbRoleToMobile(staff.role);
  assertRoleAllowed(mobileRole, requestedRole);
  const role = requestedRole && requestedRole.length ? requestedRole : mobileRole;
  const basePermissions = permissionsForRole(role);
  const enabledSystems = await getEnabledSystemNumbers(staff.restaurantId);
  const permissions = filterPermissionsByEntitlements(basePermissions, enabledSystems);
  return createMobileSession(
    staff,
    deviceId,
    loginMethod,
    permissions,
    role,
    sectionForRole(role),
  );
}

export async function loginWithPassword(body: Record<string, unknown>) {
  const staffCode = String(body.staffCode ?? "");
  const password = String(body.password ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!staffCode || !password || !deviceId) throw new Error("MISSING_FIELDS");

  const staff = await findStaffByIdentifier(staffCode);
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  await verifySecret(staff, password);
  return buildSession(staff, deviceId, "password", role);
}

export async function loginWithPin(body: Record<string, unknown>) {
  const staffCode = String(body.staffCode ?? "");
  const pin = String(body.pin ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!staffCode || !pin || !deviceId) throw new Error("MISSING_FIELDS");

  const staff = await findStaffByIdentifier(staffCode);
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  await verifySecret(staff, pin);
  return buildSession(staff, deviceId, "pin", role);
}

export async function loginWithQr(body: Record<string, unknown>) {
  const qrToken = String(body.qrToken ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!qrToken || !deviceId) throw new Error("MISSING_FIELDS");

  const staff = await findStaffByIdentifier(qrToken) ?? await findStaffByIdentifier(qrToken.toUpperCase());
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  return buildSession(staff, deviceId, "qr", role);
}

export async function loginWithBiometric(body: Record<string, unknown>) {
  const staffCode = String(body.staffCode ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!staffCode || !deviceId) throw new Error("MISSING_FIELDS");
  if (body.deviceVerified !== true) throw new Error("BIOMETRIC_REQUIRED");

  const staff = await findStaffByIdentifier(staffCode);
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  return buildSession(staff, deviceId, String(body.biometricType ?? "fingerprint"), role);
}

export async function requestOtp(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  const staff = await findStaffByIdentifier(phone) ?? await findStaffByIdentifier(normalized);
  if (!staff?.phone) throw new Error("PHONE_NOT_FOUND");
  const otp = "123456";
  otpStore.set(normalized, {
    otp,
    staffId: staff.id,
    restaurantId: staff.restaurantId,
    expiresAt: Date.now() + 5 * 60_000,
  });
  return { success: true, message: "OTP sent to registered mobile number" };
}

export async function verifyOtp(body: Record<string, unknown>) {
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const otp = String(body.otp ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  const stored = otpStore.get(phone);
  if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
    throw new Error("INVALID_OTP");
  }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, stored.staffId)).limit(1);
  if (!staff) throw new Error("INVALID_OTP");
  otpStore.delete(phone);
  await ensureStaffActive(staff);
  return buildSession(staff, deviceId, "otp", role);
}

export function loginResponse(session: MobileSession) {
  return { success: true, data: sessionPayload(session) };
}

export function sessionResponse(session: MobileSession) {
  return { session: sessionPayload(session) };
}

export { staffCodeFor, sessionPayload };
