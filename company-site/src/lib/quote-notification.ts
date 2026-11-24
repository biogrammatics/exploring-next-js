/**
 * Outbound mail for a submitted strain-design quote.
 *
 * Two messages: one telling the team a request arrived, one acknowledging it
 * to the customer so they know we have it and what happens next.
 *
 * Both are BEST EFFORT. The quote row is written before any of this runs, and
 * nothing here is allowed to throw: a Resend outage must not cost us a
 * customer's design. Failures are logged with the quote number so a missed
 * notification can be reconciled by hand.
 *
 * This is a deliberate stopgap. Delivery belongs on a retryable path (the
 * codon worker already polls for background work), so that a failure is
 * retried rather than merely logged. See AUDIT.md M24 / the TODO in
 * app/api/path-to-protein/route.ts.
 */

import { Resend } from "resend";

const FALLBACK_FROM = "BioGrammatics <noreply@links.biogrammatics.com>";

export interface QuoteNotificationInput {
  quoteNumber: string;
  contactEmail: string;
  fullName: string | null;
  organization: string | null;
  phone: string | null;
  proteinName: string | null;
  sequenceLength: number;
  /** Human-readable design summary from `summarizeDesign`. */
  summary: string;
  /** The customer's own free-text notes, if any. */
  customerNotes: string | null;
}

export interface QuoteNotificationResult {
  teamNotified: boolean;
  customerAcknowledged: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function teamEmailBody(input: QuoteNotificationInput): { subject: string; text: string; html: string } {
  const who = [input.fullName, input.organization].filter(Boolean).join(", ");
  const subject = `Strain design request ${input.quoteNumber}${
    input.proteinName ? ` — ${input.proteinName}` : ""
  }`;

  const lines = [
    `A custom strain design request came in through /path-to-protein.`,
    ``,
    `Reference:    ${input.quoteNumber}`,
    `Contact:      ${input.contactEmail}`,
    who ? `Name / org:   ${who}` : null,
    input.phone ? `Phone:        ${input.phone}` : null,
    ``,
    `--- Design ---`,
    input.summary,
    input.customerNotes ? `\n--- Customer notes ---\n${input.customerNotes}` : null,
    ``,
    `No price was quoted and nothing was charged. Reply to the customer directly.`,
  ].filter((l): l is string => l !== null);

  const text = lines.join("\n");
  return {
    subject,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(
      text
    )}</pre>`,
  };
}

function customerEmailBody(input: QuoteNotificationInput): { subject: string; text: string; html: string } {
  const subject = `We received your strain design request (${input.quoteNumber})`;
  const greeting = input.fullName ? `Hello ${input.fullName},` : "Hello,";

  const text = [
    greeting,
    ``,
    `Thank you for sending us your custom Pichia strain design${
      input.proteinName ? ` for ${input.proteinName}` : ""
    }. We have it, and your reference is ${input.quoteNumber}.`,
    ``,
    `Our team reviews every request by hand. We will come back to you by email`,
    `with a quote and any questions about the design.`,
    ``,
    `Nothing has been charged and no commitment has been made. Your sequence and`,
    `project details are treated as confidential and are used only to prepare`,
    `your quote.`,
    ``,
    `BioGrammatics`,
  ].join("\n");

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111">
  <p>${escapeHtml(greeting)}</p>
  <p>Thank you for sending us your custom Pichia strain design${
    input.proteinName ? ` for <strong>${escapeHtml(input.proteinName)}</strong>` : ""
  }. We have it, and your reference is <strong>${escapeHtml(input.quoteNumber)}</strong>.</p>
  <p>Our team reviews every request by hand. We will come back to you by email with a quote and any questions about the design.</p>
  <p style="color:#555;font-size:14px">Nothing has been charged and no commitment has been made. Your sequence and project details are treated as confidential and are used only to prepare your quote.</p>
  <p>BioGrammatics</p>
</div>`.trim();

  return { subject, text, html };
}

/**
 * Send both messages. Never throws; returns which ones actually went out.
 *
 * Skips entirely when RESEND_API_KEY is unset, so local development does not
 * emit errors on every submission.
 */
export async function sendQuoteNotifications(
  input: QuoteNotificationInput
): Promise<QuoteNotificationResult> {
  const result: QuoteNotificationResult = {
    teamNotified: false,
    customerAcknowledged: false,
  };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[quote ${input.quoteNumber}] RESEND_API_KEY unset; no notification sent.`
    );
    return result;
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || FALLBACK_FROM;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail) {
    try {
      const body = teamEmailBody(input);
      await resend.emails.send({ from, to: adminEmail, ...body });
      result.teamNotified = true;
    } catch (error) {
      // Logged, not thrown: the quote is already safely persisted.
      console.error(
        `[quote ${input.quoteNumber}] failed to notify the team:`,
        error
      );
    }
  } else {
    console.warn(
      `[quote ${input.quoteNumber}] ADMIN_EMAIL unset; team not notified.`
    );
  }

  try {
    const body = customerEmailBody(input);
    await resend.emails.send({ from, to: input.contactEmail, ...body });
    result.customerAcknowledged = true;
  } catch (error) {
    console.error(
      `[quote ${input.quoteNumber}] failed to acknowledge to the customer:`,
      error
    );
  }

  return result;
}
