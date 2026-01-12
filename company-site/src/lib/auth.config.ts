import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

// Auth config without adapter - safe for Edge runtime (middleware)
export const authConfig: NextAuthConfig = {
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
      const isAdmin = auth?.user?.role === "ADMIN";
      const pathname = nextUrl.pathname;

      // Protect /admin routes - require admin role
      if (pathname.startsWith("/admin")) {
        return isAuthenticated && isAdmin;
      }

      // Protect /account routes - require authentication
      if (pathname.startsWith("/account")) {
        return isAuthenticated;
      }

      return true;
    },
  },
};
