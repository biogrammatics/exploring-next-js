import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    vector: { findMany: vi.fn() },
    pichiaStrain: { findMany: vi.fn() },
  },
}));

import sitemap from "./sitemap";
import { prisma } from "@/lib/db";
import { publicStrainWhere, publicVectorWhere } from "@/lib/visibility";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SITE_INDEXABLE = "true";
  process.env.SITE_URL = "https://www.biogrammatics.com";
  vi.mocked(prisma.vector.findMany).mockResolvedValue([
    { id: "v1", updatedAt: new Date("2026-01-02") },
  ] as never);
  vi.mocked(prisma.pichiaStrain.findMany).mockResolvedValue([
    { id: "s1", updatedAt: new Date("2026-03-04") },
  ] as never);
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("sitemap.xml", () => {
  it("is empty while the site is not indexable", async () => {
    delete process.env.SITE_INDEXABLE;
    await expect(sitemap()).resolves.toEqual([]);
  });

  it("does not touch the database while not indexable", async () => {
    delete process.env.SITE_INDEXABLE;
    await sitemap();
    expect(prisma.vector.findMany).not.toHaveBeenCalled();
    expect(prisma.pichiaStrain.findMany).not.toHaveBeenCalled();
  });

  it("lists the public static routes", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://www.biogrammatics.com/");
    expect(urls).toContain("https://www.biogrammatics.com/path-to-protein");
    expect(urls).toContain("https://www.biogrammatics.com/vectors");
    expect(urls).toContain("https://www.biogrammatics.com/strains");
    // The codon tool is linked from nowhere on the site; the sitemap is
    // currently the only way a crawler finds it.
    expect(urls).toContain("https://www.biogrammatics.com/codon-optimization");
  });

  it("omits authenticated and transactional routes", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of ["/admin", "/account", "/cart", "/checkout", "/auth"]) {
      expect(urls.some((u) => u.includes(path))).toBe(false);
    }
  });

  it("includes catalog detail pages with their own lastModified", async () => {
    const entries = await sitemap();
    const vector = entries.find((e) => e.url.endsWith("/vectors/v1"));
    const strain = entries.find((e) => e.url.endsWith("/strains/s1"));

    expect(vector?.lastModified).toEqual(new Date("2026-01-02"));
    expect(strain?.lastModified).toEqual(new Date("2026-03-04"));
  });

  it("queries the catalog through the shared visibility predicates", async () => {
    await sitemap();
    // Never advertise a URL the detail page would 404 on.
    expect(prisma.vector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: publicVectorWhere })
    );
    expect(prisma.pichiaStrain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: publicStrainWhere })
    );
  });

  it("degrades to static routes when the database is unreachable", async () => {
    // Render builds in a container with no database access, and a deploy
    // must not fail because the sitemap could not reach Postgres.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.vector.findMany).mockRejectedValue(
      new Error("ECONNREFUSED")
    );

    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => !e.url.includes("/vectors/"))).toBe(true);
  });

  it("ranks the services route above the reagent catalogs", async () => {
    const entries = await sitemap();
    const priority = (suffix: string) =>
      entries.find((e) => e.url.endsWith(suffix))?.priority ?? 0;

    expect(priority("/path-to-protein")).toBeGreaterThan(priority("/vectors"));
  });
});
