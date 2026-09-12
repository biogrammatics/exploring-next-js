import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";
import type { Role } from "@/generated/prisma/client";

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

/**
 * Auth.js's `session` callback only sees the adapter's `user` object, not the
 * Session row, so the team-login flag stored on `Session.isTeamLogin` would be
 * lost. Wrap `getSessionAndUser` to copy it onto the user before the callback
 * runs.
 */
export const adapter: Adapter = {
  ...baseAdapter,
  async getSessionAndUser(sessionToken) {
    const result = await baseAdapter.getSessionAndUser!(sessionToken);
    if (!result) return null;
    const isTeamLogin = Boolean(
      (result.session as { isTeamLogin?: boolean }).isTeamLogin
    );
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
