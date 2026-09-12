import type { Prisma } from "@/generated/prisma/client";

/**
 * An order's charged lines live in three tables (generic products, vectors,
 * strains). Every view that shows "what was bought" must load and flatten all
 * three; the admin views previously read only `items` and so displayed
 * 0 items for every vector/strain order.
 */
export const orderLineInclude = {
  items: { include: { product: true } },
  vectorOrderItems: { include: { vector: true } },
  strainOrderItems: { include: { strain: true } },
} as const satisfies Prisma.OrderInclude;

export type OrderWithLines = Prisma.OrderGetPayload<{
  include: typeof orderLineInclude;
}>;

export type OrderLineKind = "vector" | "strain" | "product";

export interface OrderLine {
  id: string;
  kind: OrderLineKind;
  /** Product/vector/strain id, for linking. */
  refId: string;
  name: string;
  quantity: number;
  /** Cents, captured at time of purchase. */
  unitPrice: number;
  /** Cents. */
  lineTotal: number;
}

/** Structural subset so callers with a narrower include still type-check. */
type OrderLinesSource = {
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    productId: string;
    product?: { name: string } | null;
  }>;
  vectorOrderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    vectorId: string;
    vector?: { name: string } | null;
  }>;
  strainOrderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    strainId: string;
    strain?: { name: string } | null;
  }>;
};

export function flattenOrderLines(order: OrderLinesSource): OrderLine[] {
  const lines: OrderLine[] = [];

  for (const it of order.vectorOrderItems ?? []) {
    lines.push({
      id: it.id,
      kind: "vector",
      refId: it.vectorId,
      name: it.vector?.name ?? `Vector ${it.vectorId}`,
      quantity: it.quantity,
      unitPrice: it.price,
      lineTotal: it.price * it.quantity,
    });
  }
  for (const it of order.strainOrderItems ?? []) {
    lines.push({
      id: it.id,
      kind: "strain",
      refId: it.strainId,
      name: it.strain?.name ?? `Strain ${it.strainId}`,
      quantity: it.quantity,
      unitPrice: it.price,
      lineTotal: it.price * it.quantity,
    });
  }
  for (const it of order.items ?? []) {
    lines.push({
      id: it.id,
      kind: "product",
      refId: it.productId,
      name: it.product?.name ?? `Product ${it.productId}`,
      quantity: it.quantity,
      unitPrice: it.price,
      lineTotal: it.price * it.quantity,
    });
  }

  return lines;
}

/** Number of distinct lines across all three item tables. */
export function countOrderLines(order: OrderLinesSource): number {
  return (
    (order.items?.length ?? 0) +
    (order.vectorOrderItems?.length ?? 0) +
    (order.strainOrderItems?.length ?? 0)
  );
}
