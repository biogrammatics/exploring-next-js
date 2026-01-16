import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [vectorCount, strainCount, orderCount, userCount, recentOrders] = await Promise.all([
    prisma.vector.count(),
    prisma.pichiaStrain.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        vectorOrderItems: {
          include: { vector: true },
        },
        strainOrderItems: {
          include: { strain: true },
        },
      },
    }),
  ]);

  const paidOrders = await prisma.order.count({ where: { status: "PAID" } });
  const totalRevenue = await prisma.order.aggregate({
    where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
    _sum: { total: true },
  });

  // Super Admin specific stats
  const adminCount = isSuperAdmin
    ? await prisma.user.count({ where: { role: "ADMIN" } })
    : 0;
  const superAdminCount = isSuperAdmin
    ? await prisma.user.count({ where: { role: "SUPER_ADMIN" } })
    : 0;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {isSuperAdmin && (
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            Super Admin
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Link href="/admin/vectors" className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Vectors</p>
          <p className="text-3xl font-bold">{vectorCount}</p>
        </Link>
        <Link href="/admin/strains" className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Strains</p>
          <p className="text-3xl font-bold">{strainCount}</p>
        </Link>
        <Link href="/admin/orders" className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-3xl font-bold">{orderCount}</p>
        </Link>
        <Link href="/admin/users" className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-3xl font-bold">{userCount}</p>
        </Link>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold">
            {formatPrice(totalRevenue._sum.total || 0)}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order ID</th>
                <th className="text-left py-2">Customer</th>
                <th className="text-left py-2">Items</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Total</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => {
                const itemCount = order.vectorOrderItems.length + order.strainOrderItems.length;
                return (
                  <tr key={order.id} className="border-b">
                    <td className="py-2">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm text-blue-600 hover:underline">
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="py-2">{order.customerEmail || "—"}</td>
                    <td className="py-2 text-sm text-gray-600">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.status === "PAID" ? "bg-green-100 text-green-800" :
                        order.status === "SHIPPED" ? "bg-blue-100 text-blue-800" :
                        order.status === "DELIVERED" ? "bg-purple-100 text-purple-800" :
                        order.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2">{formatPrice(order.total)}</td>
                    <td className="py-2 text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Super Admin Section */}
      {isSuperAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-red-800">
            Super Admin Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Admin Users</p>
              <p className="text-2xl font-bold">{adminCount}</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Super Admins</p>
              <p className="text-2xl font-bold">{superAdminCount}</p>
            </div>
            <Link
              href="/admin/users"
              className="bg-red-600 text-white rounded-lg p-4 hover:bg-red-700 transition-colors flex items-center justify-center"
            >
              <span className="font-medium">Manage User Roles</span>
            </Link>
          </div>
          <p className="text-sm text-red-700 mt-4">
            As a Super Admin, you can promote users to Admin or Super Admin roles.
          </p>
        </div>
      )}
    </div>
  );
}
