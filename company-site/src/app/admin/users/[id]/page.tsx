import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: { product: true },
          },
        },
      },
    },
  });

  if (!user) {
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
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const totalSpent = user.orders
    .filter((o) => ["PAID", "SHIPPED", "DELIVERED"].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800",
    SHIPPED: "bg-blue-100 text-blue-800",
    DELIVERED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/users" className="text-blue-600 hover:underline">
          &larr; Back to Users
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">User Details</h1>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd>{user.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Role</dt>
              <dd>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    user.role === "ADMIN"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {user.role}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Stats</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Total Orders</dt>
              <dd className="text-2xl font-bold">{user.orders.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Total Spent</dt>
              <dd className="text-2xl font-bold">{formatPrice(totalSpent)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Order History</h2>

        {user.orders.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order ID</th>
                <th className="text-left py-2">Items</th>
                <th className="text-left py-2">Total</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user.orders.map((order) => (
                <tr key={order.id} className="border-b">
                  <td className="py-2 font-mono text-sm">
                    {order.id.slice(0, 8)}...
                  </td>
                  <td className="py-2">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </td>
                  <td className="py-2">{formatPrice(order.total)}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        statusColors[order.status] || "bg-gray-100"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-gray-500">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
