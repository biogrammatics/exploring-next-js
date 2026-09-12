import type { Prisma } from "@/generated/prisma/client";
import { PURCHASED_ORDER_STATUSES } from "@/lib/order-status";

/**
 * Catalog visibility rules, in one place.
 *
 * A product is *public* when the record is flagged `isPublic` AND its
 * ProductStatus is available. Catalog listings, detail pages, checkout, and
 * file routes must all agree on this; previously each site checked a
 * different subset of the flags (some only `isAvailable`, some only
 * `isPublic`).
 *
 * Keep this file free of server-only imports so it can be shared with
 * client components if needed.
 */

export { PURCHASED_ORDER_STATUSES };

/** Vectors visible in the public catalog. */
export const publicVectorWhere = {
  isPublic: true,
  productStatus: { isAvailable: true },
} as const satisfies Prisma.VectorWhereInput;

/** Vectors that may be added to a cart and charged for. */
export const purchasableVectorWhere = {
  ...publicVectorWhere,
  availableForSale: true,
} as const satisfies Prisma.VectorWhereInput;

/** Strains visible in the public catalog. */
export const publicStrainWhere = {
  isPublic: true,
  productStatus: { isAvailable: true },
} as const satisfies Prisma.PichiaStrainWhereInput;

/**
 * Strains that may be added to a cart. PichiaStrain has no
 * `availableForSale` flag, so this is the public predicate; the caller must
 * separately require a non-null `salePrice`.
 */
export const purchasableStrainWhere = publicStrainWhere;

type Visibility = {
  isPublic: boolean;
  productStatus: { isAvailable: boolean } | null | undefined;
};

/** In-memory equivalent of `publicVectorWhere` for an already-loaded row. */
export function isVectorPublic(v: Visibility): boolean {
  return v.isPublic === true && v.productStatus?.isAvailable === true;
}

/** In-memory equivalent of `publicStrainWhere` for an already-loaded row. */
export function isStrainPublic(s: Visibility): boolean {
  return s.isPublic === true && s.productStatus?.isAvailable === true;
}

/** In-memory equivalent of `purchasableVectorWhere` plus a price check. */
export function isVectorPurchasable(
  v: Visibility & { availableForSale: boolean; salePrice: number | null }
): boolean {
  return isVectorPublic(v) && v.availableForSale === true && !!v.salePrice;
}

/** Public + priced. */
export function isStrainPurchasable(
  s: Visibility & { salePrice: number | null }
): boolean {
  return isStrainPublic(s) && !!s.salePrice;
}
