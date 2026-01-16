import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VectorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const vectorOrderItem = await prisma.vectorOrderItem.findUnique({
    where: { id },
    include: {
      vector: {
        include: {
          promoter: true,
          selectionMarker: true,
          hostOrganism: true,
          vectorType: true,
          productStatus: true,
        },
      },
      order: {
        select: {
          userId: true,
          orderedAt: true,
          createdAt: true,
          orderNumber: true,
          status: true,
          shippingName: true,
          shippingAddress1: true,
          shippingAddress2: true,
          shippingCity: true,
          shippingState: true,
          shippingZip: true,
          shippingCountry: true,
        },
      },
    },
  });

  if (!vectorOrderItem || vectorOrderItem.order.userId !== session.user.id) {
    notFound();
  }

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
    }).format(date);
  };

  const { vector, order } = vectorOrderItem;

  const orderStatusColors: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-gray-100 text-gray-800",
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account/dashboard/vectors"
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; Back to My Vectors
          </Link>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{vector.name}</h1>
              <p className="text-gray-500 mt-1">
                Purchased on {formatDate(order.orderedAt || order.createdAt)}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                orderStatusColors[order.status] || "bg-gray-100"
              }`}
            >
              {order.status}
            </span>
          </div>

          {vector.description && (
            <p className="text-gray-600 mb-6">{vector.description}</p>
          )}

          {/* Technical Details */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Technical Details
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {vector.promoter && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Promoter</p>
                  <p className="font-medium text-gray-800">
                    {vector.promoter.name}
                  </p>
                  {vector.promoter.fullName && (
                    <p className="text-sm text-gray-600">
                      {vector.promoter.fullName}
                    </p>
                  )}
                  {vector.promoter.inducible && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                      Inducible
                    </span>
                  )}
                </div>
              )}
              {vector.selectionMarker && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Selection Marker</p>
                  <p className="font-medium text-gray-800">
                    {vector.selectionMarker.name}
                  </p>
                  {vector.selectionMarker.resistance && (
                    <p className="text-sm text-gray-600">
                      {vector.selectionMarker.resistance}
                    </p>
                  )}
                </div>
              )}
              {vector.hostOrganism && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Host Organism</p>
                  <p className="font-medium text-gray-800">
                    {vector.hostOrganism.commonName}
                  </p>
                  {vector.hostOrganism.scientificName && (
                    <p className="text-sm text-gray-600 italic">
                      {vector.hostOrganism.scientificName}
                    </p>
                  )}
                </div>
              )}
              {vector.vectorType && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Vector Type</p>
                  <p className="font-medium text-gray-800">
                    {vector.vectorType.name}
                  </p>
                </div>
              )}
              {vector.vectorSize && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Vector Size</p>
                  <p className="font-medium text-gray-800">
                    {vector.vectorSize.toLocaleString()} bp
                  </p>
                </div>
              )}
              {vector.hasLoxSites && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Features</p>
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                    Has Lox Sites
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Features */}
          {vector.features && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Features
              </h2>
              <div className="flex flex-wrap gap-2">
                {vector.features.split(",").map((feature, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {feature.trim()}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Downloads */}
          {vector.snapgeneFileUrl && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Downloads
              </h2>
              <a
                href={vector.snapgeneFileUrl}
                download={vector.snapgeneFileName || "vector.dna"}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download SnapGene File
                {vector.snapgeneFileSize && (
                  <span className="text-blue-200 text-sm">
                    ({(vector.snapgeneFileSize / 1024).toFixed(1)} KB)
                  </span>
                )}
              </a>
            </section>
          )}

          {/* Order Information */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Order Information
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Order Number</p>
                <p className="font-mono text-gray-800">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Quantity</p>
                <p className="text-gray-800">{vectorOrderItem.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Price Paid</p>
                <p className="text-xl font-bold text-gray-800">
                  {formatPrice(vectorOrderItem.price)}
                </p>
              </div>
              {order.shippingAddress1 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Shipped To</p>
                  <p className="text-gray-800">
                    {order.shippingName}
                    <br />
                    {order.shippingAddress1}
                    {order.shippingAddress2 && (
                      <>
                        <br />
                        {order.shippingAddress2}
                      </>
                    )}
                    <br />
                    {order.shippingCity}, {order.shippingState}{" "}
                    {order.shippingZip}
                    <br />
                    {order.shippingCountry}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
