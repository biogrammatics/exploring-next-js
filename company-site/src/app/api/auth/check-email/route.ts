import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if this is a primary account email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({
        exists: true,
        type: "primary",
      });
    }

    // Check if this is an authorized team email
    const authorizedEmail = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (authorizedEmail) {
      return NextResponse.json({
        exists: true,
        type: "team",
        // Don't expose the actual account email for security
      });
    }

    // Check if there's a pending invitation
    const pendingInvite = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        status: "PENDING",
      },
      select: { id: true },
    });

    if (pendingInvite) {
      return NextResponse.json({
        exists: false,
        pendingInvite: true,
      });
    }

    return NextResponse.json({
      exists: false,
    });
  } catch (error) {
    console.error("Error checking email:", error);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 }
    );
  }
}
