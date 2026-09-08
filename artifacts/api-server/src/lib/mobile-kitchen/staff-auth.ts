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
import {
  verifyStaffQrToken,
  verifyDeviceToken,
  makeDeviceToken,
  generateOtp,
} from "./staff-tokens.js";
import { isEmailConfigured, sendEmail } from "../email.js";
import { logger } from "../logger.js";

const otpStore = new Map<
  string,
  { otp: string; staffId: number; restaurantId: number; expiresAt: number; attempts: number }
>();

/**
 * Get the code to the staff member. There is no SMS provider wired up yet, so email is
 * the only real channel; when neither is available the code is logged server-side so an
 * administrator can read it from the logs. It is never returned in the HTTP response —
 * that would put the code in the hands of whoever asked for it.
 */
async function deliverStaffOtp(
  staff: { id: number; name: string | null; email: string | null },
  otp: string,
): Promise<void> {
  if (staff.email && (await isEmailConfigured())) {
    await sendEmail({
      to: staff.email,
      subject: "Your Fastap staff login code",
      html: `<p>Hi ${staff.name ?? "there"},</p><p>Your login code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
      text: `Your Fastap login code is ${otp} (expires in 5 minutes).`,
    }).catch(err => logger.error({ err, staffId: staff.id }, "could not email staff OTP"));
    return;
  }
  logger.warn(
    { staffId: staff.id, otp },
    "no delivery channel for staff OTP — code written to the server log only",
  );
}

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

/**
 * QR login. The scanned value must be a token this server minted for one staff member
 * (see makeStaffQrToken, issued by the restaurant panel to a signed-in manager).
 * A bare staff code, email or phone is no longer accepted: those are printed on rosters,
 * so treating one as proof of identity signed in anyone who could read a name badge.
 */
export async function loginWithQr(body: Record<string, unknown>) {
  const qrToken = String(body.qrToken ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!qrToken || !deviceId) throw new Error("MISSING_FIELDS");

  const staffId = verifyStaffQrToken(qrToken);
  if (staffId === null) throw new Error("INVALID_CREDENTIALS");

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  return buildSession(staff, deviceId, "qr", role);
}

/**
 * Biometric login. The fingerprint or face check happens on the handset and cannot be
 * verified from here — the previous version simply believed a `deviceVerified: true`
 * flag in the request body, which anyone could send.
 *
 * Instead the app replays the device token it was issued at its last real login. The
 * biometric prompt guards the app's own storage; this token proves the server already
 * granted this handset a session for this staff member.
 */
export async function loginWithBiometric(body: Record<string, unknown>) {
  const deviceToken = String(body.deviceToken ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  if (!deviceId) throw new Error("MISSING_FIELDS");
  if (!deviceToken) throw new Error("BIOMETRIC_NOT_ENROLLED");

  const staffId = verifyDeviceToken(deviceToken, deviceId);
  if (staffId === null) throw new Error("BIOMETRIC_NOT_ENROLLED");

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) throw new Error("INVALID_CREDENTIALS");
  await ensureStaffActive(staff);
  return buildSession(staff, deviceId, String(body.biometricType ?? "fingerprint"), role);
}

export async function requestOtp(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  const staff = await findStaffByIdentifier(phone) ?? await findStaffByIdentifier(normalized);
  // Say the same thing whether or not the number is registered, so this endpoint cannot
  // be used to discover which phone numbers belong to staff.
  if (!staff?.phone) return { success: true, message: "If that number is registered, an OTP has been sent." };

  // A fixed "123456" used to be issued here, which made every staff account openable by
  // anyone who knew a phone number. The code is now random and never leaves the server.
  const otp = generateOtp();
  otpStore.set(normalized, {
    otp,
    staffId: staff.id,
    restaurantId: staff.restaurantId,
    expiresAt: Date.now() + 5 * 60_000,
    attempts: 0,
  });
  await deliverStaffOtp(staff, otp);
  return { success: true, message: "If that number is registered, an OTP has been sent." };
}

export async function verifyOtp(body: Record<string, unknown>) {
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const otp = String(body.otp ?? "");
  const deviceId = String(body.deviceId ?? "");
  const role = body.role ? String(body.role) : undefined;
  const stored = otpStore.get(phone);
  if (!stored || stored.expiresAt < Date.now()) {
    otpStore.delete(phone);
    throw new Error("INVALID_OTP");
  }
  // Five guesses per code, then it is burned — six digits fall in seconds otherwise.
  stored.attempts += 1;
  if (stored.attempts > 5) {
    otpStore.delete(phone);
    throw new Error("INVALID_OTP");
  }
  if (stored.otp !== otp) {
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
