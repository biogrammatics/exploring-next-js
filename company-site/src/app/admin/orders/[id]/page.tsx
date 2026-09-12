import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth-guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "./order-status-form";
import { orderLineInclude, flattenOrderLines } from "@/lib/order-lines";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  SHIPPING_PENDING_QUOTE,
} from "@/lib/order-status";

const KIND_LABELS = {
  vector: "Vector",
  strain: "Strain",
  product: "Product",
} as const;

const KIND_HREFS = {
  vector: (id: string) => `/admin/vectors/${id}`,
  strain: (id: string) => `/admin/strains/${id}`,
  product: () => null,
} as const;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      ...orderLineInclude,
    },
  });

  if (!order) {
    notFound();
  }

  const lines = flattenOrderLines(order);
  const shippingPending = order.shippingMethod === SHIPPING_PENDING_QUOTE;

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

  const shippingAddress = [
    order.shippingName,
    order.shippingAddress1,
    order.shippingAddress2,
    [order.shippingCity, order.shippingState, order.shippingZip]
      .filter(Boolean)
      .join(", "),
    order.shippingCountry,
  ].filter((s): s is string => !!s && s.trim().length > 0);

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
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className={`px-2 py-1 rounded text-xs ${
                ORDER_STATUS_COLORS[order.status]
              }`}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            {shippingPending && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                Shipping to be quoted
              </span>
            )}
          </div>
        </div>
        <OrderStatusForm orderId={order.id} currentStatus={order.status} />
      </div>

      {shippingPending && (
        <div className="mb-8 border border-red-200 bg-red-50 text-red-800 rounded-lg p-4 text-sm">
          The carrier rate service was unavailable when this order was placed.
          The customer was charged {formatPrice(order.subtotal)} for products
          only; shipping must be quoted and invoiced separately.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Customer</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd>{order.customerEmail || "—"}</dd>
            </div>
            {order.shippingPhone && (
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd>{order.shippingPhone}</dd>
              </div>
            )}
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
            {shippingAddress.length > 0 && (
              <div>
                <dt className="text-sm text-gray-500">Ship to</dt>
                <dd>
                  {shippingAddress.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
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
              <dt className="text-sm text-gray-500">Shipping method</dt>
              <dd>
                {shippingPending ? (
                  <span className="text-red-700 font-medium">
                    Pending quote
                  </span>
                ) : (
                  order.shippingMethod || "—"
                )}
              </dd>
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
        <h2 className="text-lg font-semibold mb-4">
          Items{" "}
          <span className="text-sm font-normal text-gray-500">
            ({lines.length})
          </span>
        </h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Product</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Price</th>
              <th className="text-left py-2">Quantity</th>
              <th className="text-left py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No items recorded for this order.
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const href = KIND_HREFS[line.kind](line.refId);
              return (
                <tr key={`${line.kind}-${line.id}`} className="border-b">
                  <td className="py-2">
                    {href ? (
                      <Link href={href} className="text-blue-600 hover:underline">
                        {line.name}
                      </Link>
                    ) : (
                      line.name
                    )}
                  </td>
                  <td className="py-2 text-sm text-gray-600">
                    {KIND_LABELS[line.kind]}
                  </td>
                  <td className="py-2">{formatPrice(line.unitPrice)}</td>
                  <td className="py-2">{line.quantity}</td>
                  <td className="py-2">{formatPrice(line.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-2 text-right text-gray-600">
                Subtotal
              </td>
              <td className="py-2">{formatPrice(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-2 text-right text-gray-600">
                Shipping
              </td>
              <td className="py-2">
                {shippingPending ? (
                  <span className="text-red-700">To be quoted</span>
                ) : (
                  formatPrice(order.shippingCost)
                )}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="py-2 text-right font-semibold">
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
