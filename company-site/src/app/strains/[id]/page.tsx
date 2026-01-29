import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StrainDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  const strain = await prisma.pichiaStrain.findUnique({
    where: { id },
    include: {
      strainType: true,
      productStatus: true,
    },
  });

  if (!strain) {
    notFound();
  }

  // If strain is not public, check if user has purchased it
  if (!strain.isPublic) {
    let hasPurchased = false;

    if (session?.user?.id) {
      const purchase = await prisma.strainOrderItem.findFirst({
        where: {
          strainId: id,
          order: {
            userId: session.user.id,
            status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
          },
        },
      });
      hasPurchased = !!purchase;
    }

    if (!hasPurchased) {
      notFound();
    }
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
          <Link href="/strains" className="text-white/80 hover:text-white">
            ← Back to Strains
          </Link>
        </nav>

        <div className="glass-panel p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{strain.name}</h1>
              <div className="flex gap-2 mt-2">
                {strain.strainType && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                    {strain.strainType.name}
                  </span>
                )}
                {strain.availability && (
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      strain.availability === "In Stock"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {strain.availability}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              {strain.salePrice && (
                <div className="text-2xl font-bold text-blue-600">
                  {formatPrice(strain.salePrice)}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {strain.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-2 text-gray-800">Description</h2>
              <p className="text-gray-600">{strain.description}</p>
            </div>
          )}

          {/* Genetic Information */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">
                Genetic Information
              </h2>
              <dl className="space-y-3">
                {strain.genotype && (
                  <div className="border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 text-sm">Genotype</dt>
                    <dd className="text-gray-800 font-mono">{strain.genotype}</dd>
                  </div>
                )}
                {strain.phenotype && (
                  <div className="border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 text-sm">Phenotype</dt>
                    <dd className="text-gray-800">{strain.phenotype}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Applications</h2>
              {strain.advantages && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Advantages</h3>
                  <p className="text-gray-700">{strain.advantages}</p>
                </div>
              )}
              {strain.applications && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Best For</h3>
                  <p className="text-gray-700">{strain.applications}</p>
                </div>
              )}
            </div>
          </div>

          {/* Culture & Storage */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Culture & Storage Information
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {strain.cultureMedia && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Culture Media</h3>
                  <p className="text-gray-700">{strain.cultureMedia}</p>
                </div>
              )}
              {strain.growthConditions && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Growth Conditions
                  </h3>
                  <p className="text-gray-700">{strain.growthConditions}</p>
                </div>
              )}
              {strain.storageConditions && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Storage Conditions
                  </h3>
                  <p className="text-gray-700">{strain.storageConditions}</p>
                </div>
              )}
              {strain.viabilityPeriod && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Viability Period
                  </h3>
                  <p className="text-gray-700">{strain.viabilityPeriod}</p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping */}
          {strain.shippingRequirements && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-2 text-blue-800">
                Shipping Information
              </h2>
              <p className="text-blue-700">{strain.shippingRequirements}</p>
            </div>
          )}

          {/* Add to Cart - Placeholder */}
          <div className="flex gap-4">
            <button className="glass-button text-white px-8 py-3 rounded-lg text-lg flex-1">
              Add to Cart
            </button>
            <Link
              href="/strains"
              className="px-8 py-3 rounded-lg text-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              View All Strains
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
