import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
  resetRateLimits,
  RATE_LIMITS,
} from "./rate-limit";

const rule = { name: "t", limit: 3, windowMs: 1000 };

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit(rule, "a", t0).ok).toBe(true);
    expect(checkRateLimit(rule, "a", t0 + 1).ok).toBe(true);
    expect(checkRateLimit(rule, "a", t0 + 2).ok).toBe(true);
    const blocked = checkRateLimit(rule, "a", t0 + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(checkRateLimit(rule, "a", t0 + 1000).ok).toBe(true);
  });

  it("keeps separate keys and rule families apart", () => {
    const t0 = 5_000;
    for (let i = 0; i < 3; i++) checkRateLimit(rule, "a", t0);
    expect(checkRateLimit(rule, "a", t0).ok).toBe(false);
    expect(checkRateLimit(rule, "b", t0).ok).toBe(true);
    expect(checkRateLimit({ ...rule, name: "other" }, "a", t0).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("rateLimitResponse", () => {
  it("is a no-op under NODE_ENV=test unless RATE_LIMIT_IN_TESTS=1", () => {
    const h = new Headers({ "x-forwarded-for": "1.1.1.1" });
    for (let i = 0; i < 20; i++) expect(rateLimitResponse(RATE_LIMITS.sendMagicLink, h)).toBeUndefined();
  });

  it("returns 429 with Retry-After once enabled and over limit", async () => {
    process.env.RATE_LIMIT_IN_TESTS = "1";
    try {
      const h = new Headers({ "x-forwarded-for": "2.2.2.2" });
      const r = RATE_LIMITS.sendMagicLink;
      for (let i = 0; i < r.limit; i++) expect(rateLimitResponse(r, h)).toBeUndefined();
      const res = rateLimitResponse(r, h);
      expect(res?.status).toBe(429);
      expect(res?.headers.get("Retry-After")).toMatch(/^\d+$/);
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS;
    }
  });

  it("also limits per identifier so one IP cannot target many addresses freely", () => {
    process.env.RATE_LIMIT_IN_TESTS = "1";
    try {
      const r = RATE_LIMITS.sendMagicLink;
      // Different IPs, same target email: the id bucket trips.
      for (let i = 0; i < r.limit; i++) {
        expect(rateLimitResponse(r, new Headers({ "x-forwarded-for": `10.0.0.${i}` }), "victim@x")).toBeUndefined();
      }
      const res = rateLimitResponse(r, new Headers({ "x-forwarded-for": "10.0.0.99" }), "victim@x");
      expect(res?.status).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS;
    }
  });
});
