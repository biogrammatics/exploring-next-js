import { describe, it, expect, afterEach } from "vitest";
import {
  absoluteUrl,
  isIndexable,
  siteUrl,
  truncateForMeta,
  PRIVATE_PATH_PREFIXES,
} from "./site";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("siteUrl", () => {
  it("falls back to the beta host when SITE_URL is unset", () => {
    delete process.env.SITE_URL;
    expect(siteUrl()).toBe("https://beta.biogrammatics.com");
  });

  it("falls back rather than throwing when SITE_URL is blank", () => {
    // An unset or empty variable must never be able to break a render.
    process.env.SITE_URL = "   ";
    expect(siteUrl()).toBe("https://beta.biogrammatics.com");
  });

  it("uses SITE_URL when set", () => {
    process.env.SITE_URL = "https://www.biogrammatics.com";
    expect(siteUrl()).toBe("https://www.biogrammatics.com");
  });

  it("strips trailing slashes so joined paths never double up", () => {
    process.env.SITE_URL = "https://www.biogrammatics.com///";
    expect(siteUrl()).toBe("https://www.biogrammatics.com");
    expect(absoluteUrl("/vectors")).toBe(
      "https://www.biogrammatics.com/vectors"
    );
  });

  it("is read per call, so a restart picks up a dashboard change", () => {
    process.env.SITE_URL = "https://one.example.com";
    expect(siteUrl()).toBe("https://one.example.com");
    process.env.SITE_URL = "https://two.example.com";
    expect(siteUrl()).toBe("https://two.example.com");
  });
});

describe("isIndexable", () => {
  it("is false when unset — staging is the safe default", () => {
    delete process.env.SITE_INDEXABLE;
    expect(isIndexable()).toBe(false);
  });

  it("is true only for the exact string 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "True", "", " true "]) {
      process.env.SITE_INDEXABLE = value;
      expect(isIndexable(), `value ${JSON.stringify(value)}`).toBe(false);
    }
    process.env.SITE_INDEXABLE = "true";
    expect(isIndexable()).toBe(true);
  });
});

describe("absoluteUrl", () => {
  it("adds a missing leading slash", () => {
    process.env.SITE_URL = "https://example.com";
    expect(absoluteUrl("vectors")).toBe("https://example.com/vectors");
  });

  it("keeps an existing leading slash", () => {
    process.env.SITE_URL = "https://example.com";
    expect(absoluteUrl("/sitemap.xml")).toBe("https://example.com/sitemap.xml");
  });
});

describe("PRIVATE_PATH_PREFIXES", () => {
  it("covers every authenticated and transactional area", () => {
    expect(PRIVATE_PATH_PREFIXES).toEqual([
      "/admin",
      "/account",
      "/api",
      "/auth",
      "/cart",
      "/checkout",
    ]);
  });
});

describe("truncateForMeta", () => {
  it("passes a short description through unchanged", () => {
    expect(truncateForMeta("A compact Pichia vector.")).toBe(
      "A compact Pichia vector."
    );
  });

  it("collapses newlines and runs of whitespace", () => {
    expect(truncateForMeta("Pichia\n\n  vector   map")).toBe(
      "Pichia vector map"
    );
  });

  it("never exceeds the limit", () => {
    const long = "word ".repeat(100);
    expect(truncateForMeta(long).length).toBeLessThanOrEqual(155);
  });

  it("breaks on a word boundary and marks the cut", () => {
    const text = `${"alpha beta ".repeat(20)}omega`;
    const result = truncateForMeta(text, 40);
    expect(result.endsWith("…")).toBe(true);
    // No half-words: everything before the ellipsis is a complete token.
    expect(result.slice(0, -1).trim().split(" ").pop()).toMatch(
      /^(alpha|beta)$/
    );
  });

  it("hard-cuts a single oversized token rather than returning nothing", () => {
    const result = truncateForMeta("x".repeat(300), 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not leave dangling punctuation before the ellipsis", () => {
    const result = truncateForMeta("Secretion leader screening, and more.", 30);
    expect(result).not.toMatch(/[.,;:\s]…$/);
  });
});
