import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  isIndexable,
  PRIVATE_PATH_PREFIXES,
  siteUrl,
} from "@/lib/site";

/**
 * Served at /robots.txt.
 *
 * Request-time rather than build-time so that flipping SITE_INDEXABLE in the
 * Render dashboard takes effect on restart, without a redeploy.
 *
 * Note on the staging posture: a robots.txt `Disallow` stops a crawler
 * fetching the page, which also stops it reading the `noindex` meta tag that
 * layout.tsx serves. The two together are belt and braces rather than a
 * contradiction — a crawler that honours robots.txt never arrives, and one
 * that ignores it still gets the stronger `noindex` signal. If beta is ever
 * linked publicly before launch, prefer allowing the crawl so `noindex` is
 * read and the URL is actively removed from the index.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATH_PREFIXES],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
