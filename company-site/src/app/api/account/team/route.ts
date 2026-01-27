import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

// GET - List all team emails for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamEmails = await prisma.authorizedEmail.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: {
        id: true,
        email: true,
        status: true,
        invitedAt: true,
        confirmedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ teamEmails });
  } catch (error) {
    console.error("Error fetching team emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch team emails" },
      { status: 500 }
    );
  }
}

// POST - Invite a new team email
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if this email is already a primary account email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already registered as a primary account" },
        { status: 400 }
      );
    }

    // Check if this email is already authorized for this account
    const existingAuthorized = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        userId: session.user.id,
        status: { in: ["ACTIVE", "PENDING"] },
      },
    });

    if (existingAuthorized) {
      return NextResponse.json(
        { error: "This email is already authorized or has a pending invitation" },
        { status: 400 }
      );
    }

    // Check if this email is authorized for another account
    const otherAccountAuth = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
        userId: { not: session.user.id },
      },
    });

    if (otherAccountAuth) {
      return NextResponse.json(
        { error: "This email is already authorized for another account" },
        { status: 400 }
      );
    }

    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create the authorized email record
    const authorizedEmail = await prisma.authorizedEmail.create({
      data: {
        email: normalizedEmail,
        userId: session.user.id,
        status: "PENDING",
        inviteToken,
        inviteTokenExpires: inviteExpires,
      },
    });

    // Send invitation email - use request origin to ensure correct domain
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "beta.biogrammatics.com";
    const baseUrl = process.env.NEXTAUTH_URL || `${protocol}://${host}`;
    const inviteUrl = `${baseUrl}/auth/accept-invite?token=${inviteToken}`;

    const fromAddress = process.env.EMAIL_FROM || "BioGrammatics <noreply@links.biogrammatics.com>";

    await resend.emails.send({
      from: fromAddress,
      to: normalizedEmail,
      subject: "You've been invited to access a BioGrammatics account",
      html: getInviteEmailHtml(normalizedEmail, session.user.email, inviteUrl),
      text: getInviteEmailText(normalizedEmail, session.user.email, inviteUrl),
    });

    return NextResponse.json({
      success: true,
      teamEmail: {
        id: authorizedEmail.id,
        email: authorizedEmail.email,
        status: authorizedEmail.status,
        invitedAt: authorizedEmail.invitedAt,
      },
    });
  } catch (error) {
    console.error("Error inviting team email:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

// DELETE - Revoke a team email
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("id");

    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const authorizedEmail = await prisma.authorizedEmail.findFirst({
      where: {
        id: emailId,
        userId: session.user.id,
      },
    });

    if (!authorizedEmail) {
      return NextResponse.json(
        { error: "Team email not found" },
        { status: 404 }
      );
    }

    // Update status to revoked
    await prisma.authorizedEmail.update({
      where: { id: emailId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking team email:", error);
    return NextResponse.json(
      { error: "Failed to revoke access" },
      { status: 500 }
    );
  }
}

function getInviteEmailHtml(email: string, accountEmail: string, url: string) {
  // Mask the account email for privacy
  const [localPart, domain] = accountEmail.split("@");
  const maskedEmail = localPart.slice(0, 3) + "***@" + domain;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">BioGrammatics</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">You've Been Invited!</h2>

    <p style="color: #4b5563;">
      The BioGrammatics account <strong>${maskedEmail}</strong> has invited <strong>${email}</strong> to have team access.
    </p>

    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #1e40af; margin: 0; font-size: 14px;">
        <strong>What is Team Access?</strong><br>
        Team access allows you to sign in with your email address and view/manage orders for the associated account. This is useful for colleagues or team members who need access to the same account.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This invitation will expire in 7 days.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin-top: 20px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>Don't recognize this invitation?</strong><br>
        If you didn't expect this invitation or don't know the sender, you can safely ignore this email. No access will be granted unless you click the link above.
      </p>
    </div>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 25px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #6b7280; word-break: break-all;">${url}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">
      BioGrammatics, Inc.<br>
      Protein Expression Experts
    </p>
  </div>
</body>
</html>
`;
}

function getInviteEmailText(email: string, accountEmail: string, url: string) {
  const [localPart, domain] = accountEmail.split("@");
  const maskedEmail = localPart.slice(0, 3) + "***@" + domain;

  return `You've Been Invited to BioGrammatics!

The BioGrammatics account ${maskedEmail} has invited ${email} to have team access.

WHAT IS TEAM ACCESS?
Team access allows you to sign in with your email address and view/manage orders for the associated account. This is useful for colleagues or team members who need access to the same account.

Accept your invitation: ${url}

This invitation will expire in 7 days.

---

Don't recognize this invitation?
If you didn't expect this invitation or don't know the sender, you can safely ignore this email. No access will be granted unless you click the link above.

---

BioGrammatics, Inc.
Protein Expression Experts
`;
}
