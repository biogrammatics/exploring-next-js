import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

// Token expiration: 24 hours
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

// POST - Request email change
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newEmail } = await request.json();

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { error: "New email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = newEmail.toLowerCase().trim();

    // Validate it's different from current email
    if (normalizedEmail === session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from your current email" },
        { status: 400 }
      );
    }

    // Check if email is already in use as a primary account
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already registered" },
        { status: 400 }
      );
    }

    // Check if email is used as a team email
    const existingTeamEmail = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
    });

    if (existingTeamEmail) {
      return NextResponse.json(
        { error: "This email is already in use as a team email. The team access must be revoked first." },
        { status: 400 }
      );
    }

    // Delete any existing change requests for this user
    await prisma.emailChangeRequest.deleteMany({
      where: { userId: session.user.id },
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);

    // Create the change request
    await prisma.emailChangeRequest.create({
      data: {
        userId: session.user.id,
        newEmail: normalizedEmail,
        token,
        expires,
      },
    });

    // Send verification email to the new address - use request origin to ensure correct domain
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "beta.biogrammatics.com";
    const baseUrl = process.env.NEXTAUTH_URL || `${protocol}://${host}`;
    const verifyUrl = `${baseUrl}/api/account/verify-email-change?token=${token}`;

    const fromAddress = process.env.EMAIL_FROM || "BioGrammatics <noreply@links.biogrammatics.com>";

    await resend.emails.send({
      from: fromAddress,
      to: normalizedEmail,
      subject: "Verify your new email address - BioGrammatics",
      html: getEmailChangeHtml(normalizedEmail, session.user.email, verifyUrl),
      text: getEmailChangeText(normalizedEmail, session.user.email, verifyUrl),
    });

    return NextResponse.json({
      success: true,
      message: `Verification email sent to ${normalizedEmail}`,
    });
  } catch (error) {
    console.error("Error requesting email change:", error);
    return NextResponse.json(
      { error: "Failed to request email change" },
      { status: 500 }
    );
  }
}

function getEmailChangeHtml(newEmail: string, currentEmail: string, url: string) {
  // Mask the current email for privacy
  const [localPart, domain] = currentEmail.split("@");
  const maskedCurrentEmail = localPart.slice(0, 3) + "***@" + domain;

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
    <h2 style="color: #1f2937; margin-top: 0;">Verify Your New Email Address</h2>

    <p style="color: #4b5563;">
      A request was made to change the email address for your BioGrammatics account from <strong>${maskedCurrentEmail}</strong> to <strong>${newEmail}</strong>.
    </p>

    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #1e40af; margin: 0; font-size: 14px;">
        <strong>Important</strong><br>
        After verification, your primary account email will be changed to this address. You will use this email to sign in from now on.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Verify New Email
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin-top: 20px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>Didn't request this?</strong><br>
        If you didn't request this email change, please ignore this email. Your account email will not be changed without clicking the link above. If you're concerned about security, please contact support.
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

function getEmailChangeText(newEmail: string, currentEmail: string, url: string) {
  const [localPart, domain] = currentEmail.split("@");
  const maskedCurrentEmail = localPart.slice(0, 3) + "***@" + domain;

  return `Verify Your New Email Address - BioGrammatics

A request was made to change the email address for your BioGrammatics account from ${maskedCurrentEmail} to ${newEmail}.

IMPORTANT
After verification, your primary account email will be changed to this address. You will use this email to sign in from now on.

Verify your new email: ${url}

This link will expire in 24 hours.

---

Didn't request this?
If you didn't request this email change, please ignore this email. Your account email will not be changed without clicking the link above. If you're concerned about security, please contact support.

---

BioGrammatics, Inc.
Protein Expression Experts
`;
}
