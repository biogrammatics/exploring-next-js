import { describe, it, expect, afterEach } from "vitest";
import robots from "./robots";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("robots.txt", () => {
  it("disallows everything while the site is not indexable", () => {
    delete process.env.SITE_INDEXABLE;
    const result = robots();
    expect(result.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("advertises no sitemap while disallowed", () => {
    delete process.env.SITE_INDEXABLE;
    // Handing a crawler a list of staging URLs would defeat the disallow.
    expect(robots().sitemap).toBeUndefined();
  });

  it("opens the site once SITE_INDEXABLE is set", () => {
    process.env.SITE_INDEXABLE = "true";
    process.env.SITE_URL = "https://www.biogrammatics.com";

    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.allow).toBe("/");
    expect(result.sitemap).toBe("https://www.biogrammatics.com/sitemap.xml");
  });

  it("still shields private areas once public", () => {
    process.env.SITE_INDEXABLE = "true";
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.disallow).toEqual(
      expect.arrayContaining([
        "/admin",
        "/account",
        "/api",
        "/auth",
        "/cart",
        "/checkout",
      ])
    );
  });

  it("points the sitemap at the configured origin, not the default", () => {
    process.env.SITE_INDEXABLE = "true";
    process.env.SITE_URL = "https://staging.example.com";
    expect(robots().sitemap).toBe("https://staging.example.com/sitemap.xml");
  });
});
