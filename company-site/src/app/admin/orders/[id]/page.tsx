import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "./order-status-form";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      items: {
        include: { product: true },
      },
    },
  });

  if (!order) {
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
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/orders" className="text-blue-600 hover:underline">
          &larr; Back to Orders
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Order Details</h1>
          <p className="text-gray-500 font-mono">{order.id}</p>
        </div>
        <OrderStatusForm orderId={order.id} currentStatus={order.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Customer</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd>{order.customerEmail || "—"}</dd>
            </div>
            {order.user && (
              <div>
                <dt className="text-sm text-gray-500">User Account</dt>
                <dd>
                  <Link
                    href={`/admin/users/${order.user.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.user.email}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Order Info</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Placed</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Total</dt>
              <dd className="text-xl font-bold">{formatPrice(order.total)}</dd>
            </div>
            {order.stripeSessionId && (
              <div>
                <dt className="text-sm text-gray-500">Stripe Session</dt>
                <dd className="font-mono text-sm truncate">
                  {order.stripeSessionId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Items</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Product</th>
              <th className="text-left py-2">Price</th>
              <th className="text-left py-2">Quantity</th>
              <th className="text-left py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.product.name}</td>
                <td className="py-2">{formatPrice(item.price)}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">
                  {formatPrice(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold">
                Total
              </td>
              <td className="py-2 font-bold">{formatPrice(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
