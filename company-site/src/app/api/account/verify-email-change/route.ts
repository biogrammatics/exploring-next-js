import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Check if new email is still available
    const existingUser = await prisma.user.findUnique({
      where: { email: changeRequest.newEmail },
    });

    if (existingUser) {
      await prisma.emailChangeRequest.delete({
        where: { id: changeRequest.id },
      });
      return NextResponse.redirect(
        new URL("/auth/error?error=EmailAlreadyInUse", request.url)
      );
    }

    // Get old email for reference
    const oldEmail = changeRequest.user.email;
    const newEmail = changeRequest.newEmail;

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
