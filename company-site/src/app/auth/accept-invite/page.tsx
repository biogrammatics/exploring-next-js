import { prisma } from "@/lib/db";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            This invitation link is invalid or incomplete.
          </p>
          <Link
            href="/auth/signin"
            className="text-blue-600 hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  // Find the invitation
  const authorizedEmail = await prisma.authorizedEmail.findFirst({
    where: {
      inviteToken: token,
      status: "PENDING",
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!authorizedEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold mb-2">Invalid or Expired Invitation</h1>
          <p className="text-gray-600 mb-6">
            This invitation link has already been used, expired, or is invalid.
            Please contact the account owner to send a new invitation.
          </p>
          <Link
            href="/auth/signin"
            className="text-blue-600 hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  // Check if invitation has expired
  if (authorizedEmail.inviteTokenExpires && new Date() > authorizedEmail.inviteTokenExpires) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-3xl font-bold mb-2">Invitation Expired</h1>
          <p className="text-gray-600 mb-6">
            This invitation has expired. Please contact the account owner to send a new invitation.
          </p>
          <Link
            href="/auth/signin"
            className="text-blue-600 hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  // Accept the invitation - update status
  await prisma.authorizedEmail.update({
    where: { id: authorizedEmail.id },
    data: {
      status: "ACTIVE",
      confirmedAt: new Date(),
      inviteToken: null,
      inviteTokenExpires: null,
    },
  });

  // Mask the account email for display
  const [localPart, domain] = authorizedEmail.user.email.split("@");
  const maskedAccountEmail = localPart.slice(0, 3) + "***@" + domain;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold mb-2">Invitation Accepted!</h1>
        <p className="text-gray-600 mb-4">
          Your email <strong>{authorizedEmail.email}</strong> now has team access
          to the BioGrammatics account <strong>{maskedAccountEmail}</strong>.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-green-800 text-sm">
            <strong>What&apos;s next?</strong>
            <br />
            You can now sign in using your email address ({authorizedEmail.email}).
            You&apos;ll have access to view and manage orders for this account.
          </p>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Sign In Now
        </Link>
      </div>
    </main>
  );
}
