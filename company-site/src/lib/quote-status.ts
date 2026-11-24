import type { QuoteStatus } from "@/generated/prisma/client";

/**
 * Service-quote lifecycle, in one place. Client components import from here
 * too, so keep this file free of server-only imports.
 */
export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  "PENDING",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "DECLINED",
];

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    (QUOTE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Quotes still waiting on us. Drives the "needs attention" count, because the
 * notification email is otherwise the only thing telling anyone a request
 * arrived — and an email that was missed leaves no trace.
 */
export const QUOTE_OPEN_STATUSES: readonly QuoteStatus[] = [
  "PENDING",
  "CONTACTED",
];

/**
 * Unlike ORDER statuses, every quote transition is allowed.
 *
 * An order's status is partly derived from money that Stripe has actually
 * moved, so ADMIN_ORDER_TRANSITIONS exists to stop an admin forging a payment
 * state. A quote status is a purely internal sales label with no financial
 * consequence: a mis-click needs undoing, and a declined enquiry that comes
 * back next quarter needs reviving. Constraining it would only get in the way.
 *
 * Concurrency is still handled — the PATCH handler applies the change with a
 * conditional update on the expected current status, so two admins editing the
 * same quote cannot silently overwrite each other (the lesson of AUDIT.md H51).
 */
export const QUOTE_STATUS_LABELS: Readonly<Record<QuoteStatus, string>> = {
  PENDING: "New",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  DECLINED: "Declined",
};

export const QUOTE_STATUS_COLORS: Readonly<Record<QuoteStatus, string>> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONTACTED: "bg-blue-100 text-blue-800",
  QUOTED: "bg-indigo-100 text-indigo-800",
  CONVERTED: "bg-green-100 text-green-800",
  DECLINED: "bg-gray-100 text-gray-800",
};

/**
 * Timestamp stamped the first time a quote reaches a status, and never
 * cleared: `contactedAt` means "when we first made contact", so walking the
 * status back and forward must not rewrite history.
 */
export const QUOTE_STATUS_TIMESTAMP: Readonly<
  Partial<Record<QuoteStatus, "contactedAt" | "quotedAt">>
> = {
  CONTACTED: "contactedAt",
  QUOTED: "quotedAt",
};

export const MAX_ADMIN_NOTES_LENGTH = 8000;
