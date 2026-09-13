import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/identity";
import { SESSION_AUTH_VERSION } from "@/lib/session-version";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    // Build base URL from request headers to ensure correct domain
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "beta.biogrammatics.com";
    const baseUrl = `${protocol}://${host}`;

    if (!token || !email) {
      return NextResponse.redirect(new URL("/auth/error?error=InvalidToken", baseUrl));
    }

    const normalizedEmail = normalizeEmail(email);

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token,
      },
    });

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/auth/error?error=InvalidToken", baseUrl));
    }

    // Check if token is expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: normalizedEmail,
            token,
          },
        },
      });
      return NextResponse.redirect(new URL("/auth/error?error=TokenExpired", baseUrl));
    }

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token,
        },
      },
    });

    // Resolve the account. A primary User always wins: an address that is both
    // a primary account AND someone else's authorized team email must land in
    // its own account, never in the other person's. Only when no primary user
    // exists do we consult ACTIVE AuthorizedEmail rows (team login). This is
    // the same order check-email uses.
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    let isTeamLogin = false;

    if (!user) {
      const authorizedEmail = await prisma.authorizedEmail.findFirst({
        where: {
          email: normalizedEmail,
          status: "ACTIVE",
        },
        include: {
          user: true,
        },
      });

      if (authorizedEmail) {
        // Team email login - use the associated owner account
        user = authorizedEmail.user;
        isTeamLogin = true;
      } else {
        // Brand-new primary account
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
          },
        });

        // Link any existing orders to this user. Legacy orders may have been
        // stored with mixed-case addresses, so match insensitively.
        await prisma.order.updateMany({
          where: {
            customerEmail: { equals: normalizedEmail, mode: "insensitive" },
            userId: null,
          },
          data: { userId: user.id },
        });
      }
    }

    // Create a session for the user
    // Generate a session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create the session in the database. Team logins are flagged on the
    // Session row so the auth adapter can strip elevated roles and block
    // account-identity changes for the colleague's session.
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
        isTeamLogin,
        teamEmail: isTeamLogin ? normalizedEmail : null,
        authVersion: SESSION_AUTH_VERSION,
      },
    });

    // Set the session cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    // NextAuth uses different cookie names based on whether secure cookies are used
    const cookieName = isProduction
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    cookieStore.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      expires,
      path: "/",
    });

    // Redirect to home page (with team login indicator if applicable)
    const redirectUrl = isTeamLogin
      ? "/?team_login=true"
      : "/";

    return NextResponse.redirect(new URL(redirectUrl, baseUrl));
  } catch (error) {
    console.error("Error verifying magic link:", error);
    // Build base URL for error case (may not have baseUrl in scope)
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "beta.biogrammatics.com";
    const errorBaseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(new URL("/auth/error?error=Verification", errorBaseUrl));
  }
}
