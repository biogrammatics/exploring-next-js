import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth-guards";
import Link from "next/link";
import { orderLineInclude, countOrderLines } from "@/lib/order-lines";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  SHIPPING_PENDING_QUOTE,
} from "@/lib/order-status";

export default async function AdminOrdersPage() {
  await requireAdminPage();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      ...orderLineInclude,
    },
  });

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
      <h1 className="text-3xl font-bold mb-8">Orders</h1>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4">Order ID</th>
              <th className="text-left py-3 px-4">Customer</th>
              <th className="text-left py-3 px-4">Items</th>
              <th className="text-left py-3 px-4">Total</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const itemCount = countOrderLines(order);
              return (
                <tr key={order.id} className="border-t">
                  <td className="py-3 px-4 font-mono text-sm">
                    {order.id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p>{order.customerEmail || "—"}</p>
                      {order.user && (
                        <p className="text-xs text-gray-500">
                          User: {order.user.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </td>
                  <td className="py-3 px-4">
                    {formatPrice(order.total)}
                    {order.shippingMethod === SHIPPING_PENDING_QUOTE && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                        + shipping
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        ORDER_STATUS_COLORS[order.status]
                      }`}
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
