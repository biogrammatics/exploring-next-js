import { NextRequest, NextResponse } from "next/server";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/identity";
import { formatZodError } from "@/lib/validations";
import {
  validateProteinSequence,
  MAX_PROTEIN_LENGTH,
  TOO_LONG_MESSAGE,
} from "@/lib/codon-optimization";
import {
  designSubmissionSchema,
  summarizeDesign,
  tagById,
} from "@/lib/path-to-protein";
import { sendQuoteNotifications } from "@/lib/quote-notification";

/**
 * POST /api/path-to-protein
 *
 * Takes a completed strain design from the wizard and records it as a
 * ServiceQuote for the team to price by hand. Nothing is charged, no Stripe
 * object is created, and no price is computed or stored.
 *
 * Contact handling follows the same ladder as codon-optimization intake, so
 * that every entry point agrees on who a customer is:
 *
 *   1. An explicitly supplied address wins (a customer may want the quote sent
 *      somewhere other than their login address).
 *   2. Otherwise a signed-in customer falls back to their account address.
 *   3. A guest with neither is rejected — the address is the only way we can
 *      reply with a quote.
 *
 * The stored address is always normalized, because `User.email`,
 * `Order.customerEmail` and `AuthorizedEmail.email` are normalized too. A
 * quote stored as "Tom@Lab.Org" would never reconcile against the account the
 * same person later signs in with.
 *
 * `userId` is set ONLY from the session, never by looking the address up. The
 * address on an open form is unverified, so linking it to an account would let
 * anyone attach a record to someone else's dashboard. Guest quotes are matched
 * to accounts by the team, the same way the Stripe webhook only links an order
 * to a user after the payment itself has been verified.
 */

/** Raw-body cap applied before the O(n) cleaning pass, as in codon intake. */
const MAX_RAW_SEQUENCE_CHARS = Math.floor(MAX_PROTEIN_LENGTH * 1.5);

function sanitize(value: string | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimitResponse(RATE_LIMITS.quoteSubmit, request.headers);
    if (limited) return limited;

    const session = await auth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = designSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission", details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const design = parsed.data;

    // Cheap early exit before cleaning a huge payload.
    if (design.proteinSequence.length > MAX_RAW_SEQUENCE_CHARS) {
      return NextResponse.json(
        {
          error: "Invalid protein sequence",
          details: [
            TOO_LONG_MESSAGE(design.proteinSequence.replace(/\s+/g, "").length),
          ],
        },
        { status: 400 }
      );
    }

    // The same gate the codon optimizer uses: 20 standard amino acids, one
    // optional trailing stop, whitespace and a FASTA header tolerated.
    const validation = validateProteinSequence(design.proteinSequence);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Invalid protein sequence", details: validation.errors },
        { status: 400 }
      );
    }

    // ---- contact resolution (see the ladder in the header comment) ----
    let contactEmail: string | null = null;
    if (design.contact.email) {
      if (!isValidEmail(design.contact.email)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }
      contactEmail = normalizeEmail(design.contact.email);
    } else if (session?.user?.email && !session.user.isTeamLogin) {
      // Only an account owner's address is safe to assume. On a team login
      // `session.user.email` is the OWNER's address, not the colleague's, so
      // falling back to it would address the quote to the wrong person.
      contactEmail = normalizeEmail(session.user.email);
    }

    if (!contactEmail) {
      return NextResponse.json(
        {
          error: session?.user?.isTeamLogin
            ? "Please enter the email address the quote should go to. You are signed in through a shared team login, so we cannot assume it is yours."
            : "An email address is required so we can send you a quote. Sign in, or enter one below.",
        },
        { status: 400 }
      );
    }

    // Second pass, now keyed on the resolved address. The per-IP check above
    // bounds one client; this bounds using the form to mail-bomb a particular
    // third party from many addresses, as send-magic-link does (AUDIT.md H9).
    const limitedByAddress = rateLimitResponse(
      RATE_LIMITS.quoteSubmit,
      request.headers,
      contactEmail
    );
    if (limitedByAddress) return limitedByAddress;

    const tagNames = design.tags
      .map((t) => {
        const def = tagById(t.tagId);
        return def?.isCustom ? t.customName || "Custom element" : def?.name;
      })
      .filter((n): n is string => Boolean(n));

    const quote = await prisma.serviceQuote.create({
      data: {
        emailAddress: contactEmail,
        fullName: sanitize(design.contact.fullName, 200),
        organization: sanitize(design.contact.organization, 200),
        phoneNumber: sanitize(design.contact.phone, 50),

        projectName: sanitize(design.projectName, 200),
        targetProteinName:
          sanitize(design.proteinName, 200) ?? validation.fastaHeader ?? null,
        proteinTags: tagNames.length > 0 ? tagNames.join(", ") : null,

        // Customer's own words stay separate from the generated summary.
        notes: sanitize(design.contact.notes, 4000),
        specialRequirements: summarizeDesign(design, validation.length),

        // Full machine-readable design. `selectedServices` is the only Json
        // column on this model; adding a dedicated one needs a migration
        // (blocked by AUDIT.md C4 / A6), so the whole design lives here.
        selectedServices: {
          version: 1,
          design: { ...design, proteinSequence: validation.cleanedSequence },
          sequenceLength: validation.length,
        },

        // No price is computed. The team quotes by hand.
        estimatedTotal: null,

        status: "PENDING",
        userId: session?.user?.id ?? null,
      },
      select: { id: true, quoteNumber: true, createdAt: true },
    });

    // Best effort, and deliberately after the write: the quote is already safe,
    // so a mail failure is logged rather than surfaced. Still a stopgap —
    // delivery belongs on a retryable path (see quote-notification.ts).
    // sendQuoteNotifications is contracted not to throw, but it is wrapped
    // anyway: past this line the customer's design is already saved, and no
    // bug in mail delivery may turn a successful submission into a 500 that
    // invites them to submit again.
    let teamNotified = false;
    try {
      ({ teamNotified } = await sendQuoteNotifications({
        quoteNumber: quote.quoteNumber,
        contactEmail,
        fullName: sanitize(design.contact.fullName, 200),
        organization: sanitize(design.contact.organization, 200),
        phone: sanitize(design.contact.phone, 50),
        proteinName: sanitize(design.proteinName, 200),
        sequenceLength: validation.length,
        summary: summarizeDesign(design, validation.length),
        customerNotes: sanitize(design.contact.notes, 4000),
      }));
    } catch (error) {
      console.error(
        `[quote ${quote.quoteNumber}] notification threw unexpectedly:`,
        error
      );
    }

    if (!teamNotified) {
      // Loud, because nobody is watching the table yet.
      console.error(
        `[quote ${quote.quoteNumber}] stored but the team was NOT notified — reconcile by hand.`
      );
    }

    return NextResponse.json({
      success: true,
      quoteNumber: quote.quoteNumber,
      sequenceLength: validation.length,
      warnings: validation.warnings,
      message:
        "Thank you. Your design has been sent to our team, who will review it by hand and reply by email with a quote.",
    });
  } catch (error) {
    console.error("Error submitting strain design:", error);
    return NextResponse.json(
      { error: "Failed to submit your design" },
      { status: 500 }
    );
  }
}
