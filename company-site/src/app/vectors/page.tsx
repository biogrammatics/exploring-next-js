import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function VectorsPage() {
  const vectors = await prisma.vector.findMany({
    where: {
      productStatus: {
        isAvailable: true,
      },
    },
    include: {
      promoter: true,
      selectionMarker: true,
      hostOrganism: true,
      vectorType: true,
      productStatus: true,
    },
    orderBy: { name: "asc" },
  });

  // Group vectors by category
  const expressionVectors = vectors.filter(
    (v) => v.category === "HETEROLOGOUS_PROTEIN_EXPRESSION"
  );
  const engineeringVectors = vectors.filter(
    (v) => v.category === "GENOME_ENGINEERING"
  );

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">
          Expression Vectors
        </h1>
        <p className="text-xl text-white/90 mb-8 max-w-3xl">
          High-quality vectors optimized for protein expression in <em>Pichia pastoris</em>
        </p>

        {/* Heterologous Protein Expression */}
        {expressionVectors.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-white drop-shadow">
              Heterologous Protein Expression
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expressionVectors.map((vector) => (
                <VectorCard key={vector.id} vector={vector} />
              ))}
            </div>
          </section>
        )}

        {/* Genome Engineering */}
        {engineeringVectors.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-white drop-shadow">
              Genome Engineering
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {engineeringVectors.map((vector) => (
                <VectorCard key={vector.id} vector={vector} />
              ))}
            </div>
          </section>
        )}

        {vectors.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <p className="text-gray-600">No vectors available at this time.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function VectorCard({ vector }: { vector: Awaited<ReturnType<typeof getVectors>>[number] }) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <Link href={`/vectors/${vector.id}`} className="block">
      <div className="glass-panel h-full hover:shadow-lg transition-shadow overflow-hidden">
        {/* Thumbnail */}
        {vector.thumbnailBase64 ? (
          <div className="w-full aspect-square bg-gray-100">
            <img
              src={vector.thumbnailBase64}
              alt={`${vector.name} vector map`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-blue-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        <div className="p-6">
          <h3 className="text-xl font-bold mb-2 text-gray-800">{vector.name}</h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {vector.description}
          </p>

          <div className="space-y-2 text-sm mb-4">
            {vector.promoter && (
              <div className="flex justify-between">
                <span className="text-gray-500">Promoter:</span>
                <span className="text-gray-700 font-medium">{vector.promoter.name}</span>
              </div>
            )}
            {vector.selectionMarker && (
              <div className="flex justify-between">
                <span className="text-gray-500">Selection:</span>
                <span className="text-gray-700 font-medium">{vector.selectionMarker.name}</span>
              </div>
            )}
            {vector.vectorSize && (
              <div className="flex justify-between">
                <span className="text-gray-500">Size:</span>
                <span className="text-gray-700 font-medium">{vector.vectorSize.toLocaleString()} bp</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            {vector.salePrice && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Price:</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatPrice(vector.salePrice)}
                </span>
              </div>
            )}
            {vector.subscriptionPrice && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-gray-500 text-sm">Subscription:</span>
                <span className="text-sm text-green-600">
                  {formatPrice(vector.subscriptionPrice)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Type helper
async function getVectors() {
  return prisma.vector.findMany({
    include: {
      promoter: true,
      selectionMarker: true,
      hostOrganism: true,
      vectorType: true,
      productStatus: true,
    },
  });
}
