import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TeamEmailManager } from "@/app/components/account/team-email-manager";

export default async function TeamAccessPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
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

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account"
            className="text-blue-200 hover:text-white transition-colors"
          >
            ← Back to Account
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
          Team Access
        </h1>
        <p className="text-white/80 mb-8">
          Allow colleagues to access your account using their own email addresses
        </p>

        <div className="glass-panel p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              How Team Access Works
            </h2>
            <p className="text-gray-600 text-sm">
              Team members can sign in with their own email and will have access
              to view and manage orders for your account. They&apos;ll receive
              team-specific sign-in emails that clearly indicate they&apos;re
              accessing your account.
            </p>
          </div>

          <TeamEmailManager
            initialTeamEmails={teamEmails.map((te) => ({
              ...te,
              status: te.status as "ACTIVE" | "PENDING",
            }))}
          />
        </div>
      </div>
    </main>
  );
}
