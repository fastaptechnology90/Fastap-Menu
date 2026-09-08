import crypto from "node:crypto";

/**
 * Signed, expiring tokens for the two staff login methods that carry no password.
 *
 * Why these exist
 * ---------------
 * QR login used to accept a bare staff identifier — an email, phone or staff code —
 * and sign the holder straight in. Those codes are printed on rosters and in docs, so
 * anyone who knew one was that staff member. Biometric login was worse: it trusted a
 * `deviceVerified: true` flag sent by the client, which anyone can send.
 *
 * Both now require a token this server minted and signed:
 *
 *  - **QR**: the restaurant panel mints a short-lived token for one staff member and
 *    renders it as a QR. Scanning it is proof the person was handed it by a manager.
 *  - **Device**: issued on a successful password / PIN / OTP login and stored by the
 *    app. Biometric login replays it, so the fingerprint unlocks a credential the
 *    server already granted to that device rather than being the credential itself.
 *
 * Both are stateless HMACs over the server secret — no table, no migration. They bind
 * the staff id (and for device tokens the device id) so a token minted for one person
 * or one handset cannot be replayed for another.
 */

const SECRET = process.env.SESSION_SECRET ?? "fastapmenu-secret-change-in-production";

/** A QR is handed over in person and used immediately. Ten minutes is plenty. */
const QR_TTL_MS = 10 * 60 * 1000;

/** A device token survives a shift pattern, so biometrics keep working for a month. */
const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type TokenScope = "qr" | "device";

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function make(scope: TokenScope, parts: string[], ttlMs: number): string {
  const payload = [scope, ...parts, String(Date.now() + ttlMs)].join(":");
  return `${b64url(payload)}.${sign(payload)}`;
}

function verify(scope: TokenScope, token: string, expectedParts: number): string[] | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload);
  // Length guard first — timingSafeEqual throws on a mismatch rather than returning false.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const segments = payload.split(":");
  if (segments.length !== expectedParts + 2) return null;
  if (segments[0] !== scope) return null;

  const exp = Number(segments[segments.length - 1]);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  return segments.slice(1, -1);
}

/** Mint the token behind a staff QR code. Only ever called from an authenticated route. */
export function makeStaffQrToken(staffId: number): string {
  return make("qr", [String(staffId)], QR_TTL_MS);
}

/** Returns the staff id the QR was minted for, or null if it is forged, altered or stale. */
export function verifyStaffQrToken(token: string): number | null {
  const parts = verify("qr", token, 1);
  if (!parts) return null;
  const staffId = Number(parts[0]);
  return Number.isInteger(staffId) && staffId > 0 ? staffId : null;
}

/** Issued after a real login so the handset can offer biometric unlock next time. */
export function makeDeviceToken(staffId: number, deviceId: string): string {
  return make("device", [String(staffId), b64url(deviceId)], DEVICE_TTL_MS);
}

/**
 * Confirms this device token was issued to this exact handset. The device id is
 * re-checked rather than trusted from the request, so a token lifted from one phone
 * cannot be replayed from another.
 */
export function verifyDeviceToken(token: string, deviceId: string): number | null {
  const parts = verify("device", token, 2);
  if (!parts) return null;
  const staffId = Number(parts[0]);
  if (!Number.isInteger(staffId) || staffId <= 0) return null;
  if (parts[1] !== b64url(deviceId)) return null;
  return staffId;
}

/** Six random digits. Never derived from the phone number, never predictable. */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
