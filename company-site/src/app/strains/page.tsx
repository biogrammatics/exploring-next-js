import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function StrainsPage() {
  const strains = await prisma.pichiaStrain.findMany({
    where: {
      productStatus: {
        isAvailable: true,
      },
    },
    include: {
      strainType: true,
      productStatus: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">
          Pichia Strains
        </h1>
        <p className="text-xl text-white/90 mb-8 max-w-3xl">
          Ready-to-use <em>Pichia pastoris</em> strains for protein expression
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {strains.map((strain) => (
            <StrainCard key={strain.id} strain={strain} />
          ))}
        </div>

        {strains.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <p className="text-gray-600">No strains available at this time.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function StrainCard({ strain }: { strain: Awaited<ReturnType<typeof getStrains>>[number] }) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <Link href={`/strains/${strain.id}`} className="block">
      <div className="glass-panel p-6 h-full hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-gray-800">{strain.name}</h3>
          {strain.availability && (
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                strain.availability === "In Stock"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {strain.availability}
            </span>
          )}
        </div>

        {strain.strainType && (
          <p className="text-sm text-blue-600 mb-2">{strain.strainType.name}</p>
        )}

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {strain.description}
        </p>

        <div className="space-y-2 text-sm mb-4">
          {strain.genotype && (
            <div className="flex justify-between">
              <span className="text-gray-500">Genotype:</span>
              <span className="text-gray-700 font-mono text-xs">{strain.genotype}</span>
            </div>
          )}
          {strain.phenotype && (
            <div className="flex justify-between">
              <span className="text-gray-500">Phenotype:</span>
              <span className="text-gray-700">{strain.phenotype}</span>
            </div>
          )}
        </div>

        {strain.advantages && (
          <p className="text-gray-500 text-sm mb-4 line-clamp-2">
            <strong>Advantages:</strong> {strain.advantages}
          </p>
        )}

        <div className="border-t border-gray-200 pt-4">
          {strain.salePrice && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Price:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatPrice(strain.salePrice)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Type helper
async function getStrains() {
  return prisma.pichiaStrain.findMany({
    include: {
      strainType: true,
      productStatus: true,
    },
  });
}
