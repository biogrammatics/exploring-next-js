import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PurchasedVectorsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const purchasedVectors = await prisma.vectorOrderItem.findMany({
    where: {
      order: {
        userId: session.user.id,
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      },
    },
    include: {
      vector: {
        include: {
          promoter: true,
          selectionMarker: true,
          hostOrganism: true,
          vectorType: true,
        },
      },
      order: {
        select: {
          orderedAt: true,
          createdAt: true,
          orderNumber: true,
          status: true,
        },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(date);
  };

  const orderStatusColors: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-gray-100 text-gray-800",
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account/dashboard"
            className="text-blue-400 hover:text-blue-300"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
          My Vectors
        </h1>
        <p className="text-white/80 mb-8">
          All vectors you&apos;ve purchased are listed below.
        </p>

        {purchasedVectors.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <p className="text-gray-600 mb-4">
              You haven&apos;t purchased any vectors yet.
            </p>
            <Link
              href="/vectors"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Browse Vectors
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {purchasedVectors.map((item) => (
              <div
                key={item.id}
                className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-800">
                      {item.vector.name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        orderStatusColors[item.order.status] || "bg-gray-100"
                      }`}
                    >
                      {item.order.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    {item.vector.promoter && (
                      <div>
                        <span className="text-gray-500">Promoter:</span>{" "}
                        <span className="font-medium">
                          {item.vector.promoter.name}
                        </span>
                      </div>
                    )}
                    {item.vector.selectionMarker && (
                      <div>
                        <span className="text-gray-500">Selection:</span>{" "}
                        <span className="font-medium">
                          {item.vector.selectionMarker.name}
                        </span>
                      </div>
                    )}
                    {item.vector.vectorSize && (
                      <div>
                        <span className="text-gray-500">Size:</span>{" "}
                        <span className="font-medium">
                          {item.vector.vectorSize.toLocaleString()} bp
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Quantity:</span>{" "}
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Purchased on{" "}
                    {formatDate(item.order.orderedAt || item.order.createdAt)} •
                    Order #{item.order.orderNumber.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-800">
                      {formatPrice(item.price)}
                    </p>
                    <p className="text-xs text-gray-500">Price paid</p>
                  </div>
                  <Link
                    href={`/account/dashboard/vectors/${item.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
