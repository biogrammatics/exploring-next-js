import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminVectorsPage() {
  const vectors = await prisma.vector.findMany({
    orderBy: { name: "asc" },
    include: {
      promoter: true,
      selectionMarker: true,
      productStatus: true,
    },
  });

  const formatPrice = (cents: number | null) => {
    if (!cents) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Vectors</h1>
        <Link
          href="/admin/vectors/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Vector
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Promoter</th>
              <th className="text-left py-3 px-4">Selection</th>
              <th className="text-left py-3 px-4">Price</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vectors.map((vector) => (
              <tr key={vector.id} className="border-t">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{vector.name}</p>
                    {vector.vectorSize && (
                      <p className="text-sm text-gray-500">
                        {vector.vectorSize.toLocaleString()} bp
                      </p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm">
                    {vector.category === "HETEROLOGOUS_PROTEIN_EXPRESSION"
                      ? "Protein Expression"
                      : vector.category === "GENOME_ENGINEERING"
                        ? "Genome Engineering"
                        : "—"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {vector.promoter ? (
                    <span className="text-sm">{vector.promoter.name}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">
                  {vector.selectionMarker ? (
                    <span className="text-sm">{vector.selectionMarker.name}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">{formatPrice(vector.salePrice)}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      vector.productStatus?.isAvailable
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {vector.productStatus?.name || "Unknown"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/vectors/${vector.id}/edit`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {vectors.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No vectors found. Add your first vector to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
