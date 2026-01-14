import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

// Auth config without adapter - safe for Edge runtime (middleware)
// Note: Admin role check is done in the admin layout, not here,
// because Edge runtime can't access the database
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Protect /admin and /account routes - require authentication
      // (admin role is checked in the admin layout)
      if (pathname.startsWith("/admin") || pathname.startsWith("/account")) {
        return isAuthenticated;
      }

      return true;
    },
  },
};
