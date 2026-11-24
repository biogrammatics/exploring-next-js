import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth-guards";
import {
  QUOTE_OPEN_STATUSES,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
} from "@/lib/quote-status";

export const metadata = { title: "Strain design requests | Admin" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminQuotesPage() {
  await requireAdminPage();

  const quotes = await prisma.serviceQuote.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      quoteNumber: true,
      createdAt: true,
      status: true,
      emailAddress: true,
      fullName: true,
      organization: true,
      projectName: true,
      targetProteinName: true,
      userId: true,
    },
  });

  const open = quotes.filter((q) =>
    (QUOTE_OPEN_STATUSES as readonly string[]).includes(q.status)
  ).length;

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Strain design requests</h1>
        {open > 0 && (
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            {open} awaiting a reply
          </span>
        )}
      </div>

      <p className="mb-6 max-w-3xl text-sm text-gray-600">
        Submitted through{" "}
        <Link href="/path-to-protein" className="text-blue-700 underline">
          /path-to-protein
        </Link>
        . No price is quoted by the site — every request is priced by hand and
        answered by email.
      </p>

      {quotes.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-gray-600">
          No requests yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50 text-left text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 font-medium">Received</th>
                <th className="px-6 py-3 font-medium">Contact</th>
                <th className="px-6 py-3 font-medium">Protein</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap text-gray-700">
                    {formatDate(q.createdAt)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900">
                      {q.fullName || q.emailAddress}
                    </div>
                    <div className="text-gray-600">
                      {q.organization || q.emailAddress}
                      {q.userId === null && (
                        <span
                          className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                          title="Submitted without signing in; not linked to an account"
                        >
                          guest
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {q.targetProteinName || q.projectName || (
                      <span className="text-gray-400">unnamed</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        QUOTE_STATUS_COLORS[q.status]
                      }`}
                    >
                      {QUOTE_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/admin/quotes/${q.id}`}
                      className="text-blue-700 underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
