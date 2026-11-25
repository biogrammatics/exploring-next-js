/**
 * Public site identity: the canonical origin, whether search engines may
 * index this deployment, and small helpers for building page metadata.
 *
 * Both settings are environment-driven because the same code serves two very
 * different roles. Until the beta replaces the Wix site (planned early 2027)
 * it is a staging copy of a live business, and an indexed staging copy
 * competes with production for exactly the queries production needs to win.
 *
 * Indexing is therefore OFF unless explicitly switched on, rather than on
 * unless explicitly switched off: forgetting the variable leaves the site
 * private, which is the recoverable mistake. Forgetting it the other way
 * round puts duplicate content in Google's index and takes weeks to undo.
 *
 * To launch: set SITE_INDEXABLE=true and SITE_URL=https://www.biogrammatics.com
 * in the Render dashboard. Nothing in the code needs to change.
 *
 * Read `process.env` lazily (inside the functions) rather than at module
 * scope so that flipping a variable takes effect on restart without a
 * rebuild, and so tests can exercise both states.
 */

const DEFAULT_SITE_URL = "https://beta.biogrammatics.com";

export const SITE_NAME = "BioGrammatics";

/**
 * Paths that must never be indexed, even once the site is public: anything
 * behind a login, anything transactional, and the API surface. Shared by
 * robots.ts and sitemap.ts so the two cannot drift apart.
 */
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/account",
  "/api",
  "/auth",
  "/cart",
  "/checkout",
] as const;

/** Strip trailing slashes so `absoluteUrl` never produces a double slash. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Canonical origin for this deployment, without a trailing slash.
 *
 * Falls back to the beta hostname rather than throwing: an unset variable
 * should not be able to break a build or a page render (see AUDIT L27, where
 * module-scope environment assertions did exactly that).
 */
export function siteUrl(): string {
  const configured = process.env.SITE_URL;
  return normalizeOrigin(
    configured && configured.trim() ? configured : DEFAULT_SITE_URL
  );
}

/**
 * Whether robots may crawl and index this deployment.
 *
 * Deliberately strict: only the exact string "true" enables indexing, so a
 * stray "1", "yes" or empty value leaves the site private.
 */
export function isIndexable(): boolean {
  return process.env.SITE_INDEXABLE === "true";
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${suffix}`;
}

/** Longest meta description Google will usually render. */
const META_DESCRIPTION_LIMIT = 155;

/**
 * Collapse whitespace and trim a description to a length search engines will
 * actually show, breaking on a word boundary rather than mid-word.
 */
export function truncateForMeta(
  text: string,
  limit: number = META_DESCRIPTION_LIMIT
): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;

  const clipped = collapsed.slice(0, limit - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  // Fall back to the hard cut when there is no space to break on (a single
  // very long token), so the result is never longer than the limit.
  const body = lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.replace(/[.,;:\s]+$/, "")}…`;
}
