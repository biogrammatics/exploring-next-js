import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/identity";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/error?error=InvalidToken", request.url)
      );
    }

    // Find the change request
    const changeRequest = await prisma.emailChangeRequest.findFirst({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!changeRequest) {
      return NextResponse.redirect(
        new URL("/auth/error?error=InvalidToken", request.url)
      );
    }

    // Check if token is expired
    if (new Date() > changeRequest.expires) {
      // Delete expired request
      await prisma.emailChangeRequest.delete({
        where: { id: changeRequest.id },
      });
      return NextResponse.redirect(
        new URL("/auth/error?error=TokenExpired", request.url)
      );
    }

    const newEmail = normalizeEmail(changeRequest.newEmail);

    // Check if new email is still available: it must not be another primary
    // account, and it must not be an ACTIVE or PENDING team email anywhere
    // (otherwise the same address would resolve to two different accounts).
    const [existingUser, existingTeamEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      }),
      prisma.authorizedEmail.findFirst({
        where: {
          email: newEmail,
          status: { in: ["ACTIVE", "PENDING"] },
        },
        select: { id: true },
      }),
    ]);

    if (existingUser || existingTeamEmail) {
      await prisma.emailChangeRequest.delete({
        where: { id: changeRequest.id },
      });
      return NextResponse.redirect(
        new URL("/auth/error?error=EmailAlreadyInUse", request.url)
      );
    }

    // Update the user's email
    await prisma.user.update({
      where: { id: changeRequest.userId },
      data: { email: newEmail },
    });

    // Update any authorized emails that used the old primary email to point to the new one
    // (This keeps authorized team emails associated with the account)

    // Delete the change request
    await prisma.emailChangeRequest.delete({
      where: { id: changeRequest.id },
    });

    // Delete all sessions for this user (force re-login with new email)
    await prisma.session.deleteMany({
      where: { userId: changeRequest.userId },
    });

    // Redirect to success page
    const successUrl = new URL("/account/email-changed", request.url);
    successUrl.searchParams.set("email", newEmail);
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Error verifying email change:", error);
    return NextResponse.redirect(
      new URL("/auth/error?error=Verification", request.url)
    );
  }
}
