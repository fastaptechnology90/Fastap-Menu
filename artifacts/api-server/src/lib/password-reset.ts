import crypto from "node:crypto";

// Stateless, signed password-reset tokens — no DB column / migration needed. A token
// carries the scope ("admin" | "staff"), the account id and an expiry, signed with the
// server secret. verifyResetToken re-checks the signature and expiry. Tokens are valid
// until they expire (short TTL) — good enough for a reset link; the real email delivery
// is plugged in later (SendGrid etc.).

const SECRET = process.env.SESSION_SECRET ?? "fastapmenu-secret-change-in-production";
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type ResetScope = "admin" | "staff";

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function makeResetToken(scope: ResetScope, id: number): string {
  const exp = Date.now() + RESET_TTL_MS;
  const payload = `${scope}:${id}:${exp}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

export function verifyResetToken(scope: ResetScope, token: string): { id: number } | null {
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
  // constant-time compare; guard against length mismatch which throws in timingSafeEqual
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const [scopePart, idPart, expPart] = payload.split(":");
  if (scopePart !== scope) return null;
  const id = Number(idPart);
  const exp = Number(expPart);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { id };
}
