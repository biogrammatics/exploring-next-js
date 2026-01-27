import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function isExpired(date: Date | null) {
  if (!date) return false;
  return new Date() > date;
}

export default async function VectorLotsPage({ params }: PageProps) {
  const { id } = await params;

  const vector = await prisma.vector.findUnique({
    where: { id },
    include: {
      lots: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { files: true },
          },
        },
      },
      currentShippingLot: true,
    },
  });

  if (!vector) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/admin/vectors/${id}/edit`}
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to {vector.name}
          </Link>
          <h1 className="text-3xl font-bold">Lots for {vector.name}</h1>
        </div>
        <Link
          href={`/admin/vectors/${id}/lots/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Lot
        </Link>
      </div>

      {vector.currentShippingLot && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">
            <strong>Current Shipping Lot:</strong>{" "}
            {vector.currentShippingLot.lotNumber}
          </p>
        </div>
      )}

      {vector.lots.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          No lots have been created for this vector yet.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Lot Number
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Manufactured
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Expires
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Files
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {vector.lots.map((lot) => (
                <tr key={lot.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-medium">{lot.lotNumber}</span>
                    {vector.currentShippingLotId === lot.id && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(lot.manufacturedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isExpired(lot.expiresAt)
                          ? "text-red-600"
                          : "text-gray-600"
                      }
                    >
                      {formatDate(lot.expiresAt)}
                      {isExpired(lot.expiresAt) && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                          Expired
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {lot._count.files} file{lot._count.files !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired(lot.expiresAt) ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vectors/${id}/lots/${lot.id}/edit`}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
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
