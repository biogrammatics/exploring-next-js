import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VectorDetailPage({ params }: PageProps) {
  const { id } = await params;

  const vector = await prisma.vector.findUnique({
    where: { id },
    include: {
      promoter: true,
      selectionMarker: true,
      hostOrganism: true,
      vectorType: true,
      productStatus: true,
    },
  });

  if (!vector) {
    notFound();
  }

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link href="/vectors" className="text-white/80 hover:text-white">
            ← Back to Vectors
          </Link>
        </nav>

        <div className="glass-panel p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{vector.name}</h1>
              {vector.category && (
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  {vector.category === "HETEROLOGOUS_PROTEIN_EXPRESSION"
                    ? "Protein Expression"
                    : "Genome Engineering"}
                </span>
              )}
            </div>
            <div className="text-right">
              {vector.salePrice && (
                <div className="text-2xl font-bold text-blue-600">
                  {formatPrice(vector.salePrice)}
                </div>
              )}
              {vector.subscriptionPrice && (
                <div className="text-sm text-green-600">
                  Subscription: {formatPrice(vector.subscriptionPrice)}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {vector.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">Description</h2>
              <p className="text-gray-600">{vector.description}</p>
            </div>
          )}

          {/* Specifications */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Specifications</h2>
              <dl className="space-y-3">
                {vector.promoter && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Promoter</dt>
                    <dd className="text-gray-800 font-medium">
                      {vector.promoter.name}
                      {vector.promoter.inducible && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Inducible
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {vector.selectionMarker && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Selection Marker</dt>
                    <dd className="text-gray-800 font-medium">
                      {vector.selectionMarker.name}
                      {vector.selectionMarker.concentration && (
                        <span className="text-gray-500 text-sm ml-1">
                          ({vector.selectionMarker.concentration})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {vector.vectorType && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Vector Type</dt>
                    <dd className="text-gray-800 font-medium">{vector.vectorType.name}</dd>
                  </div>
                )}
                {vector.hostOrganism && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Host Organism</dt>
                    <dd className="text-gray-800 font-medium">
                      <em>{vector.hostOrganism.commonName}</em>
                    </dd>
                  </div>
                )}
                {vector.vectorSize && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Vector Size</dt>
                    <dd className="text-gray-800 font-medium">
                      {vector.vectorSize.toLocaleString()} bp
                    </dd>
                  </div>
                )}
                {vector.hasLoxSites && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">LoxP Sites</dt>
                    <dd className="text-green-600 font-medium">Yes</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Features */}
            {vector.features && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-gray-800">Features</h2>
                <ul className="space-y-2">
                  {vector.features.split(",").map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      {feature.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Promoter Details */}
          {vector.promoter && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">
                About {vector.promoter.name} Promoter
              </h2>
              {vector.promoter.fullName && (
                <p className="text-gray-600 mb-2">
                  <strong>Full name:</strong> {vector.promoter.fullName}
                </p>
              )}
              {vector.promoter.strength && (
                <p className="text-gray-600 mb-2">
                  <strong>Strength:</strong>{" "}
                  <span
                    className={`px-2 py-0.5 rounded text-sm ${
                      vector.promoter.strength === "VERY_STRONG"
                        ? "bg-red-100 text-red-700"
                        : vector.promoter.strength === "STRONG"
                          ? "bg-orange-100 text-orange-700"
                          : vector.promoter.strength === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {vector.promoter.strength.replace("_", " ")}
                  </span>
                </p>
              )}
              <p className="text-gray-600">
                <strong>Type:</strong>{" "}
                {vector.promoter.inducible ? "Inducible" : "Constitutive"}
              </p>
            </div>
          )}

          {/* Add to Cart - Placeholder */}
          <div className="flex gap-4">
            <button className="glass-button text-white px-8 py-3 rounded-lg text-lg flex-1">
              Add to Cart
            </button>
            <Link
              href="/vectors"
              className="px-8 py-3 rounded-lg text-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              View All Vectors
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
