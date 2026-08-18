import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { resolveAdminPermissions } from "../lib/admin-rbac.js";
import { registerRateLimit, loginRateLimit } from "../middlewares/rate-limit.js";
import { isEmailConfigured, sendEmail, publicBaseUrl, verificationEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/** How long a verification link stays usable. */
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function newVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function verificationLink(req: { protocol: string; get(h: string): string | undefined }, token: string): string {
  const origin = `${req.protocol}://${req.get("host") ?? ""}`;
  return `${publicBaseUrl(origin)}/api/auth/verify-email?token=${token}`;
}

/**
 * Sends the confirmation mail and records when. Returns whether it actually left
 * the server — a false here means no provider is configured, not a failure.
 */
async function sendVerification(user: { id: number; name: string; email: string }, link: string): Promise<boolean> {
  const mail = verificationEmail(user.name, link);
  const result = await sendEmail({ to: user.email, ...mail });
  await db.update(usersTable)
    .set({ emailVerificationSentAt: new Date() })
    .where(eq(usersTable.id, user.id));
  return result.sent;
}

router.post("/auth/register", registerRateLimit, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, email, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }
  const passwordHash = await bcrypt.hash(password, 12);

  // Until now the address was taken on trust and the account was created and signed
  // in on the spot, so anyone could POST here and become a live restaurant_owner — no
  // proof of the email, no human in the loop. Two gates now stand in front of that: a
  // confirmation link proves the mailbox is real, and a super admin must approve the
  // account before it can sign in. The account is created as "pending" for that.
  const token = newVerificationToken();
  const [user] = await db.insert(usersTable).values({
    name, email, passwordHash, role: "restaurant_owner",
    emailVerificationToken: token,
    approvalStatus: "pending",
  }).returning();

  const mailWorks = await isEmailConfigured();
  const delivered = await sendVerification(user, verificationLink(req, token));

  // No session is opened here any more, whether or not mail is configured. A pending
  // account must never be signed in — that was the whole hole. The owner signs in
  // once the email is confirmed (if a provider is set up) and a super admin approves.

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    emailVerificationRequired: mailWorks,
    verificationEmailSent: delivered,
    approvalRequired: true,
    message: mailWorks
      ? "Registration received. Confirm your email address, then wait for a super admin to approve your account before signing in."
      : "Registration received. A super admin must approve your account before you can sign in.",
  });
});

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }

  // Checked only once the password is known to be right, so this never reveals
  // whether an address is registered. And only when mail can actually be delivered —
  // otherwise an unconfigured platform would lock out every one of its own admins.
  if (!user.isEmailVerified && await isEmailConfigured()) {
    res.status(403).json({
      error: "Confirm your email address before signing in. Check your inbox for the confirmation link.",
      message: "Confirm your email address before signing in. Check your inbox for the confirmation link.",
      code: "EMAIL_NOT_VERIFIED",
      emailVerificationRequired: true,
    });
    return;
  }

  // The second gate: a self-service registration stays "pending" until a super admin
  // approves it. Existing accounts and admin-created accounts default to "approved",
  // so this only ever stops a freshly self-registered owner — never a real admin.
  // Also placed after the password check, so it leaks nothing about who has an account.
  if (user.approvalStatus !== "approved") {
    const rejected = user.approvalStatus === "rejected";
    res.status(403).json({
      error: rejected
        ? "Your account was not approved. Please contact support."
        : "Your account is awaiting super admin approval. You can sign in once it is approved.",
      message: rejected
        ? "Your account was not approved. Please contact support."
        : "Your account is awaiting super admin approval. You can sign in once it is approved.",
      code: rejected ? "ACCOUNT_REJECTED" : "ACCOUNT_PENDING_APPROVAL",
      approvalPending: !rejected,
    });
    return;
  }

  req.session.userId = user.id;
  const permissions = user.role.includes("admin")
    ? [...await resolveAdminPermissions(user.role)]
    : [];
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, permissions },
    message: "Login successful",
  });
});

/**
 * Opened from the link in the confirmation email, so this is a plain browser
 * navigation, not an API call — it ends in a redirect back to the sign-in page
 * rather than JSON. The outcome is carried in the query string so the page can say
 * what happened.
 */
router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const base = publicBaseUrl(`${req.protocol}://${req.get("host") ?? ""}`);
  const back = (outcome: string) => res.redirect(`${base}/login?verified=${outcome}`);

  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) { back("invalid"); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.emailVerificationToken, token));
  if (!user) {
    // Either the link was mistyped, or it was already used — the token is cleared on
    // success, so a second click lands here. Both look the same from outside, which
    // is intentional: a valid token must not be distinguishable from a spent one.
    back("invalid");
    return;
  }

  const sentAt = user.emailVerificationSentAt?.getTime() ?? 0;
  if (sentAt && Date.now() - sentAt > VERIFICATION_TTL_MS) {
    back("expired");
    return;
  }

  await db.update(usersTable)
    .set({ isEmailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, user.id));
  logger.info({ userId: user.id }, "email verified");
  back("ok");
});

/**
 * Re-sends the link. Answers the same way whether or not the address exists, so it
 * cannot be used to find out who has an account.
 */
router.post("/auth/resend-verification", registerRateLimit, async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const done = () => res.json({
    message: "If that address needs confirming, a new link is on its way.",
  });
  if (!email) { done(); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.isEmailVerified) { done(); return; }

  // A fresh token each time, so an older link stops working once a new one is asked for.
  const token = newVerificationToken();
  await db.update(usersTable).set({ emailVerificationToken: token }).where(eq(usersTable.id, user.id));
  await sendVerification(user, verificationLink(req, token));
  done();
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const permissions = user.role.includes("admin")
    ? [...await resolveAdminPermissions(user.role)]
    : [];
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, permissions });
});

export default router;
