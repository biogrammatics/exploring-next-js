import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

// Token expiration: 24 hours
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const { email, isNewAccount } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    // Store the new token
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    });

    // Build the callback URL - use request origin to ensure correct domain
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "beta.biogrammatics.com";
    const baseUrl = process.env.NEXTAUTH_URL || `${protocol}://${host}`;
    const callbackUrl = `${baseUrl}/api/auth/verify-magic-link?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Check if this is a team email login
    const authorizedEmail = await prisma.authorizedEmail.findFirst({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Send the appropriate email
    let emailContent;
    if (authorizedEmail) {
      // Team email - send team login email
      emailContent = getTeamLoginEmailContent(normalizedEmail, callbackUrl, authorizedEmail.user.email);
    } else if (isNewAccount) {
      emailContent = getNewAccountEmailContent(normalizedEmail, callbackUrl);
    } else {
      emailContent = getSignInEmailContent(normalizedEmail, callbackUrl);
    }

    const fromAddress = process.env.EMAIL_FROM || "BioGrammatics <noreply@links.biogrammatics.com>";

    await resend.emails.send({
      from: fromAddress,
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending magic link:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

function getSignInEmailContent(email: string, url: string) {
  const subject = "Sign in to BioGrammatics";

  const html = `
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
    <h2 style="color: #1f2937; margin-top: 0;">Sign in to your account</h2>

    <p style="color: #4b5563;">
      Someone requested a sign-in link for the BioGrammatics account associated with <strong>${email}</strong>.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Sign In to BioGrammatics
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin-top: 20px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>Didn't request this?</strong><br>
        If you didn't request this sign-in link, you can safely ignore this email. Your account is secure and no action is needed.
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

  const text = `Sign in to BioGrammatics

Someone requested a sign-in link for the BioGrammatics account associated with ${email}.

Sign in here: ${url}

This link will expire in 24 hours.

---

Didn't request this?
If you didn't request this sign-in link, you can safely ignore this email. Your account is secure and no action is needed.

---

BioGrammatics, Inc.
Protein Expression Experts
`;

  return { subject, html, text };
}

function getNewAccountEmailContent(email: string, url: string) {
  const subject = "Welcome to BioGrammatics - Verify Your Email";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to BioGrammatics</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Verify your email to get started</h2>

    <p style="color: #4b5563;">
      Thanks for creating an account with BioGrammatics! Click the button below to verify your email address (<strong>${email}</strong>) and complete your account setup.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Verify Email & Sign In
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours.
    </p>

    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #166534; margin: 0; font-size: 14px;">
        <strong>What's next?</strong><br>
        Once verified, you'll be able to browse our vectors and strains, place orders, and manage custom projects.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>Didn't create this account?</strong><br>
        If you didn't sign up for a BioGrammatics account, please ignore this email. The account will not be created without verification.
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

  const text = `Welcome to BioGrammatics!

Thanks for creating an account! Click the link below to verify your email address (${email}) and complete your account setup.

Verify your email: ${url}

This link will expire in 24 hours.

---

What's next?
Once verified, you'll be able to browse our vectors and strains, place orders, and manage custom projects.

---

Didn't create this account?
If you didn't sign up for a BioGrammatics account, please ignore this email. The account will not be created without verification.

---

BioGrammatics, Inc.
Protein Expression Experts
`;

  return { subject, html, text };
}

function getTeamLoginEmailContent(email: string, url: string, accountEmail: string) {
  // Mask the account email for privacy (show first 3 chars + domain)
  const [localPart, domain] = accountEmail.split("@");
  const maskedEmail = localPart.slice(0, 3) + "***@" + domain;

  const subject = "Sign in to BioGrammatics (Team Access)";

  const html = `
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
    <h2 style="color: #1f2937; margin-top: 0;">Team Access Sign In</h2>

    <p style="color: #4b5563;">
      Someone requested a sign-in link for <strong>${email}</strong>, which has team access to the BioGrammatics account <strong>${maskedEmail}</strong>.
    </p>

    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #1e40af; margin: 0; font-size: 14px;">
        <strong>Team Access</strong><br>
        You are signing in as a team member. You'll have access to view and manage orders for the associated account.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Sign In to BioGrammatics
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin-top: 20px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>Didn't request this?</strong><br>
        If you didn't request this sign-in link, you can safely ignore this email. Your account is secure and no action is needed. If you believe your access should be removed, please contact the account owner.
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

  const text = `Team Access Sign In - BioGrammatics

Someone requested a sign-in link for ${email}, which has team access to the BioGrammatics account ${maskedEmail}.

TEAM ACCESS
You are signing in as a team member. You'll have access to view and manage orders for the associated account.

Sign in here: ${url}

This link will expire in 24 hours.

---

Didn't request this?
If you didn't request this sign-in link, you can safely ignore this email. Your account is secure and no action is needed. If you believe your access should be removed, please contact the account owner.

---

BioGrammatics, Inc.
Protein Expression Experts
`;

  return { subject, html, text };
}
