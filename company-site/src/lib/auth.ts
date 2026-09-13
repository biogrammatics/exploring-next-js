import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";
import type { Role } from "@/generated/prisma/client";
import { SESSION_AUTH_VERSION } from "./session-version";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      /** True when a colleague signed in via an owner's AuthorizedEmail. */
      isTeamLogin: boolean;
    };
  }
  interface User {
    role: Role;
    isTeamLogin?: boolean;
  }
}

const baseAdapter = PrismaAdapter(prisma) as Adapter;

type SessionRowExtras = {
  isTeamLogin?: boolean;
  teamEmail?: string | null;
  authVersion?: number | null;
};

async function invalidateSession(sessionToken: string) {
  try {
    await prisma.session.deleteMany({ where: { sessionToken } });
  } catch (err) {
    console.error("Failed to delete invalid session:", err);
  }
}

/**
 * Adapter wrapper. Three jobs on every session lookup:
 *
 * 1. Refuse rows minted under an older SESSION_AUTH_VERSION (or none). Those
 *    rows cannot say whether they belong to the owner or a colleague, so they
 *    are deleted rather than trusted with the owner's role.
 * 2. For team logins, re-check that the AuthorizedEmail is still ACTIVE, so
 *    revoking a colleague takes effect on their next request instead of when
 *    their 30-day session expires.
 * 3. Copy isTeamLogin onto the user object, because Auth.js's `session`
 *    callback never sees Session columns.
 *
 * createSession is wrapped so sessions minted by NextAuth's own provider flow
 * carry the version stamp too.
 */
export const adapter: Adapter = {
  ...baseAdapter,
  async createSession(data) {
    return prisma.session.create({
      data: { ...data, authVersion: SESSION_AUTH_VERSION },
    });
  },
  async getSessionAndUser(sessionToken) {
    const result = await baseAdapter.getSessionAndUser!(sessionToken);
    if (!result) return null;
    const row = result.session as typeof result.session & SessionRowExtras;

    if (row.authVersion !== SESSION_AUTH_VERSION) {
      await invalidateSession(sessionToken);
      return null;
    }

    const isTeamLogin = Boolean(row.isTeamLogin);
    if (isTeamLogin) {
      const active = row.teamEmail
        ? await prisma.authorizedEmail.findFirst({
            where: {
              email: row.teamEmail,
              userId: result.user.id,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : null;
      if (!active) {
        await invalidateSession(sessionToken);
        return null;
      }
    }

    return { ...result, user: { ...result.user, isTeamLogin } };
  },
};

/**
 * Exported separately so the callback can be unit-tested without standing up
 * NextAuth. A team-login session (colleague signed in through an owner's
 * AuthorizedEmail) never inherits the owner's role: it is always plain USER.
 */
export const sessionCallback: NonNullable<
  NonNullable<NextAuthConfig["callbacks"]>["session"]
> = ({ session, user }) => {
  if (session.user) {
    const isTeamLogin = Boolean(user.isTeamLogin);
    session.user.id = user.id;
    session.user.isTeamLogin = isTeamLogin;
    session.user.role = isTeamLogin ? "USER" : user.role;
  }
  return session;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    session: sessionCallback,
  },
  events: {
    // When a new user is created, link existing orders by email. Legacy orders
    // may have been stored with mixed-case addresses, so match insensitively.
    async createUser({ user }) {
      if (user.email) {
        await prisma.order.updateMany({
          where: {
            customerEmail: { equals: user.email, mode: "insensitive" },
            userId: null,
          },
          data: { userId: user.id },
        });
      }
    },
  },
});
