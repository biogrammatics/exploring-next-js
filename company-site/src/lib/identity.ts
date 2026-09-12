/**
 * Email identity rules, in one place.
 *
 * `User.email` is a case-sensitive unique column, so every path that looks up
 * or creates a user by email (magic link, checkout, Stripe webhook, team
 * invites, email change) must normalize the same way or the same person ends
 * up as two rows.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose structural check; real verification is the magic-link round trip. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email.trim());
}
