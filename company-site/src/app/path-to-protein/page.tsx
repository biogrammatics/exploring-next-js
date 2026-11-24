import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PathToProteinClient, { type ContactPrefill } from "./path-to-protein-client";

export const metadata: Metadata = {
  title: "Design a custom Pichia strain | BioGrammatics",
  description:
    "Tell us about your protein and we will design and build a whole-genome-sequenced Pichia expression strain. No pricing is shown; our team reviews every request by hand and replies with a quote.",
};

/**
 * Public custom-strain design wizard.
 *
 * Reachable without signing in, like the codon-optimization tool. A signed-in
 * customer gets their contact details pre-filled from their profile so the
 * quote attaches to the same person as their orders.
 *
 * A team login is deliberately NOT pre-filled from the owner's profile: a
 * colleague signing in through an owner's AuthorizedEmail should enter their
 * own address rather than silently quoting as the account holder.
 */
export default async function PathToProteinPage() {
  const session = await auth();

  let prefill: ContactPrefill = {};

  if (session?.user?.id && !session.user.isTeamLogin) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (user) {
      const fromParts = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      prefill = {
        email: user.email,
        fullName: fromParts || user.name || undefined,
        phone: user.phone || undefined,
      };
    }
  }

  // A team login is left entirely blank on purpose. `session.user.email` on
  // such a session is the ACCOUNT OWNER's address (the colleague's own address
  // lives on the Session row as `teamEmail` and is not exposed here), so
  // pre-filling it would quote the owner for work a colleague asked about, and
  // send our reply to the wrong person.
  const isTeamLogin = Boolean(session?.user?.isTeamLogin);

  return (
    <PathToProteinClient
      prefill={prefill}
      signedIn={Boolean(session?.user)}
      isTeamLogin={isTeamLogin}
    />
  );
}
