import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StrainDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const strainOrderItem = await prisma.strainOrderItem.findUnique({
    where: { id },
    include: {
      strain: {
        include: {
          strainType: true,
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

  if (!strainOrderItem || strainOrderItem.order.userId !== session.user.id) {
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

  const { strain, order } = strainOrderItem;

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
            href="/account/dashboard/strains"
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; Back to My Strains
          </Link>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{strain.name}</h1>
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

          {strain.description && (
            <p className="text-gray-600 mb-6">{strain.description}</p>
          )}

          {/* Biological Details */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Biological Details
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {strain.strainType && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Strain Type</p>
                  <p className="font-medium text-gray-800">
                    {strain.strainType.name}
                  </p>
                  {strain.strainType.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {strain.strainType.description}
                    </p>
                  )}
                </div>
              )}
              {strain.genotype && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Genotype</p>
                  <p className="font-mono text-sm text-gray-800 break-all">
                    {strain.genotype}
                  </p>
                </div>
              )}
              {strain.phenotype && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Phenotype</p>
                  <p className="text-gray-800">{strain.phenotype}</p>
                </div>
              )}
              {strain.advantages && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Advantages</p>
                  <p className="text-gray-800">{strain.advantages}</p>
                </div>
              )}
            </div>
          </section>

          {/* Applications */}
          {strain.applications && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Applications
              </h2>
              <p className="text-gray-600">{strain.applications}</p>
            </section>
          )}

          {/* Culture & Storage Information */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Culture & Storage
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {strain.storageConditions && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Storage Conditions</p>
                  <p className="text-gray-800">{strain.storageConditions}</p>
                </div>
              )}
              {strain.viabilityPeriod && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Viability Period</p>
                  <p className="text-gray-800">{strain.viabilityPeriod}</p>
                </div>
              )}
              {strain.cultureMedia && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Culture Media</p>
                  <p className="text-gray-800">{strain.cultureMedia}</p>
                </div>
              )}
              {strain.growthConditions && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Growth Conditions</p>
                  <p className="text-gray-800">{strain.growthConditions}</p>
                </div>
              )}
            </div>
          </section>

          {/* Shipping Information */}
          {strain.shippingRequirements && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Shipping Requirements
              </h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">{strain.shippingRequirements}</p>
              </div>
            </section>
          )}

          {/* Citations */}
          {strain.citations && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Citations
              </h2>
              <p className="text-gray-600 text-sm">{strain.citations}</p>
            </section>
          )}

          {/* File Downloads */}
          {strain.hasFiles && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Associated Files
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  {strain.fileNotes ||
                    "Files are available for this strain. Please contact support for access."}
                </p>
              </div>
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
                <p className="text-gray-800">{strainOrderItem.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Price Paid</p>
                <p className="text-xl font-bold text-gray-800">
                  {formatPrice(strainOrderItem.price)}
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
