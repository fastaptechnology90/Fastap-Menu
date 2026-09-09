import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger.js";

/**
 * Small in-memory rate limiter for the account-creation endpoints.
 *
 * Why in-memory: `fastap-api` runs under PM2 in fork mode (a single process),
 * so one shared Map is enough. If the app is ever moved to cluster mode this
 * must be swapped for a shared store (Redis, or the existing Postgres pool),
 * otherwise each worker keeps its own counter and the effective limit
 * multiplies by the number of workers.
 *
 * `app.set("trust proxy", 1)` is already configured in app.ts, so req.ip is the
 * real client address from Nginx's X-Forwarded-For rather than 127.0.0.1.
 */

type Hit = { count: number; resetAt: number };

export interface RateLimitOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per key inside the window. */
  max: number;
  /** Label used in logs so different limiters can be told apart. */
  name: string;
  /** Message returned to the client when the limit is hit. */
  message?: string;
  /** Defaults to the client IP. Override to bucket by email, user id, etc. */
  keyGenerator?: (req: Request) => string;
  /**
   * Count only the attempts that failed.
   *
   * A sign-in limit exists to slow guessing, and a correct password is not a guess. Without
   * this a cashier who legitimately signs in ten times over a shift — handover, a reloaded
   * tab, a handset going to sleep — spends the whole budget and is locked out for being
   * right. Successful responses give their slot back.
   */
  countFailuresOnly?: boolean;
}

/** Buckets are kept per limiter so /register and /login never share a counter. */
const buckets = new Map<string, Map<string, Hit>>();

// Drop expired entries so a long-running process does not grow unbounded.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [, bucket] of buckets) {
    for (const [key, hit] of bucket) {
      if (hit.resetAt <= now) bucket.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref?.();

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, name, message, keyGenerator, countFailuresOnly } = opts;

  if (!buckets.has(name)) buckets.set(name, new Map());
  const bucket = buckets.get(name)!;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyGenerator ? keyGenerator(req) : (req.ip ?? "unknown");
    const now = Date.now();

    let hit = bucket.get(key);
    if (!hit || hit.resetAt <= now) {
      hit = { count: 0, resetAt: now + windowMs };
      bucket.set(key, hit);
    }

    hit.count += 1;

    const remaining = Math.max(0, max - hit.count);
    const resetSeconds = Math.ceil((hit.resetAt - now) / 1000);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (countFailuresOnly) {
      res.on("finish", () => {
        if (res.statusCode < 400 && hit!.count > 0) hit!.count -= 1;
      });
    }

    if (hit.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));
      logger.warn(
        { limiter: name, key, count: hit.count, max, path: req.originalUrl },
        "rate limit exceeded",
      );
      res.status(429).json({
        error: message ?? "Too many requests. Please try again later.",
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Account creation — the expensive, abusable one.
 * A genuine owner registers once; 5 attempts an hour leaves room for typos and
 * retries while making bulk signup scripts useless.
 */
export const registerRateLimit = rateLimit({
  name: "register",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts from this network. Please try again in an hour.",
});

/**
 * Restaurant creation by an already-authenticated owner.
 * Keyed by user id, not IP — several owners can legitimately share one office
 * network, and one owner should not be blocked by another's activity.
 */
export const createRestaurantRateLimit = rateLimit({
  name: "create-restaurant",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many restaurants created. Please try again in an hour.",
  keyGenerator: (req) => String(req.session?.userId ?? req.ip ?? "unknown"),
});

/**
 * Login — slows password guessing without locking a venue out of its own tills.
 *
 * This used to fall back to `req.ip` with 20 attempts per 15 minutes. Every device in a
 * restaurant — kitchen display, three waiter handhelds, the cashier terminal, the
 * manager's laptop — leaves through one public address, so twenty attempts was the whole
 * building's budget for a quarter of an hour. At shift change, when eight people sign in
 * at once on greasy touchscreens, the venue locked itself out mid-service with no
 * override; a server restart, which signs every tablet out at once, did the same.
 *
 * Guessing is per-account, so the limit belongs on the account. The identifier the caller
 * is trying to sign in as is the key — email, staff code or phone — and a wide per-network
 * ceiling still sits behind it to stop one address working through a list of accounts.
 */
function loginIdentity(req: Request): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = body.email ?? body.staffCode ?? body.code ?? body.phone ?? body.username;
  const id = String(raw ?? "").trim().toLowerCase();
  return id ? `id:${id}` : `ip:${req.ip ?? "unknown"}`;
}

export const loginRateLimit = rateLimit({
  name: "login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts for this account. Please try again in 15 minutes.",
  keyGenerator: loginIdentity,
  countFailuresOnly: true,
});

/**
 * The ceiling behind it: one network may not work through the whole staff list. Set high
 * enough that a full venue signing on at shift change never reaches it.
 */
export const loginNetworkRateLimit = rateLimit({
  name: "login-network",
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many sign-in attempts from this network. Please try again shortly.",
  countFailuresOnly: true,
});

/**
 * Asking for a one-time code. Keyed on the phone number, because the cost of the abuse
 * falls on whoever owns that number.
 */
export const otpSendRateLimit = rateLimit({
  name: "otp-send",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many codes requested for this number. Please wait a few minutes.",
  keyGenerator: (req) => {
    const phone = String((req.body as Record<string, unknown> | undefined)?.phone ?? "").replace(/\D/g, "");
    return phone ? `phone:${phone}` : `ip:${req.ip ?? "unknown"}`;
  },
});

/** Guessing a six-digit code. Ten tries per number per quarter hour makes it useless. */
export const otpVerifyRateLimit = rateLimit({
  name: "otp-verify",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts. Please request a new code.",
  keyGenerator: (req) => {
    const phone = String((req.body as Record<string, unknown> | undefined)?.phone ?? "").replace(/\D/g, "");
    return phone ? `phone:${phone}` : `ip:${req.ip ?? "unknown"}`;
  },
  countFailuresOnly: true,
});
