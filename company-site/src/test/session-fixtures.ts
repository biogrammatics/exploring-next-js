import type { Session } from "next-auth";
import type { Role } from "@/generated/prisma/client";

/**
 * Build a fake authenticated session for route tests. Not a *.test.ts file, so
 * Vitest does not treat it as a suite.
 */
export function makeSession(
  role: Role = "USER",
  overrides: Partial<Session["user"]> = {}
): Session {
  return {
    user: {
      id: "user_1",
      email: "user@example.com",
      role,
      ...overrides,
    },
    expires: "2999-01-01T00:00:00.000Z",
  } as Session;
}

export const anonymousSession = null;
export const userSession = makeSession("USER");
export const adminSession = makeSession("ADMIN", {
  id: "admin_1",
  email: "admin@example.com",
});
export const superAdminSession = makeSession("SUPER_ADMIN", {
  id: "super_1",
  email: "super@example.com",
});
