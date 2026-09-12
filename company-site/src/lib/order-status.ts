import type { OrderStatus } from "@/generated/prisma/client";

/**
 * Order lifecycle, in one place. Client components import from here too, so
 * keep this file free of server-only imports.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "PAYMENT_FAILED",
  "REFUNDED",
  "DISPUTED",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/** Statuses that count as "the customer has bought this" for entitlement. */
export const PURCHASED_ORDER_STATUSES: readonly OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

/**
 * Transitions an admin may perform by hand. Payment-derived states
 * (PAID, PAYMENT_FAILED, REFUNDED, DISPUTED) are written by the Stripe
 * webhook; an admin can move an order forward through fulfilment or cancel
 * it, but cannot mark an unpaid order as paid or reopen a refunded one.
 */
export const ADMIN_ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: ["CANCELLED"],
  REFUNDED: [],
  DISPUTED: ["REFUNDED", "CANCELLED"],
};

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_ORDER_TRANSITIONS[from].includes(to);
}

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  PAYMENT_FAILED: "Payment failed",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
};

export const ORDER_STATUS_COLORS: Readonly<Record<OrderStatus, string>> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
  PAYMENT_FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800",
  DISPUTED: "bg-orange-100 text-orange-800",
};

/**
 * Sentinel stored in Order.shippingMethod when checkout completed while the
 * carrier API was unavailable, so admins can see shipping is still owed.
 */
export const SHIPPING_PENDING_QUOTE = "PENDING_QUOTE";
