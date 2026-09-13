import { NextResponse } from "next/server";

/**
 * Interim in-memory rate limiter (fixed window per key).
 *
 * Good enough for the current single-instance web service: it bounds
 * mail-bombing, enumeration and job-submission abuse from one client. It is
 * NOT shared across instances or restarts — replace the store with Upstash
 * Redis or Arcjet before scaling past one instance (AUDIT.md H37).
 *
 * Disabled under Vitest (NODE_ENV=test) unless RATE_LIMIT_IN_TESTS=1, so
 * route tests can call handlers repeatedly; rate-limit.test.ts exercises the
 * limiter directly with an injected clock.
 */
export interface RateLimitRule {
  /** Identifies the bucket family, e.g. "send-magic-link". */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  rule: RateLimitRule,
  key: string,
  now: number = Date.now()
): RateLimitResult {
  sweep(now);
  const k = `${rule.name}:${key}`;
  let b = store.get(k);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs };
    store.set(k, b);
  }
  b.count += 1;
  const ok = b.count <= rule.limit;
  return {
    ok,
    remaining: Math.max(0, rule.limit - b.count),
    retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

function enabled(): boolean {
  return process.env.NODE_ENV !== "test" || process.env.RATE_LIMIT_IN_TESTS === "1";
}

/**
 * Route helper. Returns a 429 response when the caller is over the limit,
 * otherwise undefined. `extraKey` lets a route also limit per identifier
 * (e.g. the target email) in addition to per IP.
 */
export function rateLimitResponse(
  rule: RateLimitRule,
  headers: Headers,
  extraKey?: string
): NextResponse | undefined {
  if (!enabled()) return undefined;
  const keys = [clientIp(headers)];
  if (extraKey) keys.push(`id:${extraKey}`);
  for (const key of keys) {
    const r = checkRateLimit(rule, key);
    if (!r.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } }
      );
    }
  }
  return undefined;
}

/** Test hook. */
export function resetRateLimits() {
  store.clear();
  lastSweep = 0;
}

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const RATE_LIMITS = {
  /** Outbound mail on demand: tight. */
  sendMagicLink: { name: "send-magic-link", limit: 5, windowMs: FIFTEEN_MIN },
  changeEmail: { name: "change-email", limit: 5, windowMs: ONE_HOUR },
  teamInvite: { name: "team-invite", limit: 10, windowMs: ONE_HOUR },
  /** Enumeration surface: looser, but bounded. */
  checkEmail: { name: "check-email", limit: 30, windowMs: FIFTEEN_MIN },
  /** CPU + mail: per IP. */
  codonSubmit: { name: "codon-submit", limit: 10, windowMs: ONE_HOUR },
} as const satisfies Record<string, RateLimitRule>;
