import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminStrainsPage() {
  const strains = await prisma.pichiaStrain.findMany({
    orderBy: { name: "asc" },
    include: {
      strainType: true,
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
        <h1 className="text-3xl font-bold">Pichia Strains</h1>
        <Link
          href="/admin/strains/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Strain
        </Link>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Genotype</th>
              <th className="text-left py-3 px-4">Price</th>
              <th className="text-left py-3 px-4">Availability</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {strains.map((strain) => (
              <tr key={strain.id} className="border-t">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{strain.name}</p>
                    {strain.phenotype && (
                      <p className="text-sm text-gray-500">{strain.phenotype}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {strain.strainType ? (
                    <span className="text-sm">{strain.strainType.name}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">
                  {strain.genotype ? (
                    <span className="text-sm font-mono">{strain.genotype}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">{formatPrice(strain.salePrice)}</td>
                <td className="py-3 px-4">
                  {strain.availability ? (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        strain.availability === "In Stock"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {strain.availability}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      strain.productStatus?.isAvailable
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {strain.productStatus?.name || "Unknown"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/strains/${strain.id}/edit`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {strains.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No strains found. Add your first strain to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
