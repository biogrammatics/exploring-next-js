/**
 * Version stamp written onto every Session row this codebase mints.
 *
 * The auth adapter refuses (and deletes) any session whose authVersion does
 * not match, so bumping this number invalidates every existing session on
 * its next use. Bump it whenever the meaning of a Session row changes in a
 * way that makes older rows untrustworthy.
 *
 *   1 — rows carry isTeamLogin/teamEmail. Sessions minted before this column
 *       existed cannot say whether they belong to the owner or a colleague,
 *       so they are invalidated rather than assumed to be the owner.
 */
export const SESSION_AUTH_VERSION = 1;
