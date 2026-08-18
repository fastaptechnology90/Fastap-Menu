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
  const { windowMs, max, name, message, keyGenerator } = opts;

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
 * Login — slows password guessing without locking out a person who
 * mistypes a few times.
 */
export const loginRateLimit = rateLimit({
  name: "login",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Please try again in 15 minutes.",
});
