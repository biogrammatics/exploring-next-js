import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth-guards";
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS } from "@/lib/quote-status";
import { QuoteAdminForm } from "./quote-admin-form";

export const metadata = { title: "Strain design request | Admin" };

type PageProps = { params: Promise<{ id: string }> };

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** The design JSON written by the submission route. */
interface StoredDesign {
  version?: number;
  sequenceLength?: number;
  design?: { proteinSequence?: string };
}

export default async function AdminQuoteDetailPage({ params }: PageProps) {
  await requireAdminPage();
  const { id } = await params;

  const quote = await prisma.serviceQuote.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!quote) notFound();

  const stored = (quote.selectedServices ?? null) as StoredDesign | null;
  const sequence = stored?.design?.proteinSequence ?? null;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/quotes" className="text-sm text-blue-700 underline">
        ← All requests
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {quote.targetProteinName || quote.projectName || "Strain design request"}
          </h1>
          <p className="mt-1 font-mono text-sm text-gray-600">
            {quote.quoteNumber}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            QUOTE_STATUS_COLORS[quote.status]
          }`}
        >
          {QUOTE_STATUS_LABELS[quote.status]}
        </span>
      </div>

      {/* ---- contact ---- */}
      <section className="mb-6 rounded-lg border bg-white p-6">
        <h2 className="mb-3 font-semibold text-gray-900">Contact</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Email">
            <a
              href={`mailto:${quote.emailAddress}?subject=${encodeURIComponent(
                `Your BioGrammatics strain design request (${quote.quoteNumber})`
              )}`}
              className="text-blue-700 underline"
            >
              {quote.emailAddress}
            </a>
          </Row>
          <Row label="Name">{quote.fullName || <Muted>not given</Muted>}</Row>
          <Row label="Organization">
            {quote.organization || <Muted>not given</Muted>}
          </Row>
          <Row label="Phone">{quote.phoneNumber || <Muted>not given</Muted>}</Row>
          <Row label="Account">
            {quote.user ? (
              <Link
                href={`/admin/users/${quote.user.id}`}
                className="text-blue-700 underline"
              >
                {quote.user.email}
              </Link>
            ) : (
              <Muted>
                guest — submitted without signing in, so this address is
                unverified
              </Muted>
            )}
          </Row>
          <Row label="Received">{formatDate(quote.createdAt)}</Row>
          {quote.contactedAt && (
            <Row label="First contacted">{formatDate(quote.contactedAt)}</Row>
          )}
          {quote.quotedAt && <Row label="Quoted">{formatDate(quote.quotedAt)}</Row>}
        </dl>
      </section>

      {/* ---- what they asked for ---- */}
      <section className="mb-6 rounded-lg border bg-white p-6">
        <h2 className="mb-1 font-semibold text-gray-900">The request</h2>
        <p className="mb-4 text-xs text-gray-500">
          As submitted by the customer. Not editable — this is the record of
          what they asked for. Put corrections in the internal notes below.
        </p>

        {quote.notes && (
          <div className="mb-4">
            <h3 className="mb-1 text-sm font-medium text-gray-800">
              Customer&rsquo;s note
            </h3>
            <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              {quote.notes}
            </p>
          </div>
        )}

        {quote.proteinTags && (
          <p className="mb-4 text-sm">
            <span className="text-gray-600">Tags:</span> {quote.proteinTags}
          </p>
        )}

        {quote.specialRequirements && (
          <div className="mb-4">
            <h3 className="mb-1 text-sm font-medium text-gray-800">Design</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800">
              {quote.specialRequirements}
            </pre>
          </div>
        )}

        {sequence && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-800">
              Protein sequence ({stored?.sequenceLength ?? sequence.length} aa)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs break-all whitespace-pre-wrap text-gray-800">
              {sequence}
            </pre>
          </details>
        )}
      </section>

      {/* ---- editable ---- */}
      <QuoteAdminForm
        quoteId={quote.id}
        quoteNumber={quote.quoteNumber}
        currentStatus={quote.status}
        currentNotes={quote.adminNotes}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-400">{children}</span>;
}
