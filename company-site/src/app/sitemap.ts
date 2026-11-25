import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl, isIndexable } from "@/lib/site";
import { publicStrainWhere, publicVectorWhere } from "@/lib/visibility";

/**
 * Served at /sitemap.xml.
 *
 * MUST stay request-time. Render builds the app in a container that cannot
 * reach the database's internal hostname (see CLAUDE.md), so a sitemap
 * generated at build time would fail every deploy. `force-dynamic` keeps the
 * Prisma query out of the build, and the try/catch below means an unreachable
 * database degrades to a static-routes-only sitemap instead of a 500.
 */
export const dynamic = "force-dynamic";

/**
 * Hand-maintained public routes, highest commercial value first.
 *
 * `/pichia-protein-expression-services` ranks directly below the homepage: it
 * is the page the business most needs to win, and the one the AI-search review
 * found missing. `/path-to-protein` sits with the catalogs — it is a tool that
 * feeds the CRO business rather than the page that explains it. `/products` is
 * listed last and low because it overlaps /vectors and /strains — that
 * duplication is a separate decision, not a sitemap problem.
 *
 * Not listed: /cart, /checkout/*, /auth/*, /account/*, /admin/* — all either
 * transactional or behind a login.
 */
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  {
    path: "/pichia-protein-expression-services",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  { path: "/path-to-protein", priority: 0.8, changeFrequency: "monthly" },
  { path: "/vectors", priority: 0.8, changeFrequency: "weekly" },
  { path: "/strains", priority: 0.8, changeFrequency: "weekly" },
  { path: "/codon-optimization", priority: 0.7, changeFrequency: "monthly" },
  { path: "/products", priority: 0.5, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // While the site is not indexable, advertise nothing. Keeps a stray fetch
  // of /sitemap.xml from handing a crawler a list of staging URLs.
  if (!isIndexable()) return [];

  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    // Visibility predicates come from @/lib/visibility so the sitemap can
    // never advertise a vector or strain the detail page would 404.
    const [vectors, strains] = await Promise.all([
      prisma.vector.findMany({
        where: publicVectorWhere,
        select: { id: true, updatedAt: true },
      }),
      prisma.pichiaStrain.findMany({
        where: publicStrainWhere,
        select: { id: true, updatedAt: true },
      }),
    ]);

    for (const vector of vectors) {
      entries.push({
        url: absoluteUrl(`/vectors/${vector.id}`),
        lastModified: vector.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    for (const strain of strains) {
      entries.push({
        url: absoluteUrl(`/strains/${strain.id}`),
        lastModified: strain.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (error) {
    // A sitemap missing its catalog is far better than a 500: Google retries,
    // and the static routes still get discovered.
    console.error(
      "[sitemap] catalog query failed; serving static routes only:",
      error
    );
  }

  return entries;
}
