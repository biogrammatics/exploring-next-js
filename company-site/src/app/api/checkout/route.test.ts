import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies so the route's pricing/persistence logic
//    can be exercised without a database, Stripe, auth, or the network. ───────
vi.mock("@/lib/db", () => ({
  prisma: {
    vector: { findUnique: vi.fn() },
    pichiaStrain: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    order: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/shipstation", () => ({ getQuotedRates: vi.fn() }));

import { POST } from "./route";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { getQuotedRates } from "@/lib/shipstation";

type Body = Record<string, unknown>;

function makeRequest(body: Body) {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof POST>[0];
}

const shipping = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "555-0100",
  address1: "1 Analytical Way",
  address2: "",
  city: "Carlsbad",
  state: "CA",
  zip: "92011",
  country: "US",
};

type CreatedItems = { create: Array<Record<string, unknown>> };
type OrderData = {
  subtotal: number;
  total: number;
  shippingCost: number;
  shippingMethod: string | null;
  userId?: string;
  vectorOrderItems: CreatedItems;
  strainOrderItems: CreatedItems;
  items: CreatedItems;
};

/** The data object passed to prisma.order.create in the most recent call. */
function lastOrderData(): OrderData {
  return vi.mocked(prisma.order.create).mock.calls.at(-1)![0]
    .data as unknown as OrderData;
}

type StripeArgs = {
  line_items: Array<{
    price_data: { unit_amount: number; product_data: { name: string } };
  }>;
};

/** The args passed to stripe.checkout.sessions.create in the most recent call. */
function lastStripeArgs(): StripeArgs {
  return vi.mocked(stripe.checkout.sessions.create).mock.calls.at(-1)![0] as unknown as StripeArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(null as never);
  vi.mocked(prisma.order.create).mockResolvedValue({ id: "order_1" } as never);
  vi.mocked(prisma.order.update).mockResolvedValue({} as never);
  vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
    id: "cs_test_123",
    url: "https://stripe.test/checkout",
  } as never);

  vi.mocked(prisma.vector.findUnique).mockResolvedValue({
    id: "vec_1",
    name: "pJAN",
    description: "Expression vector",
    salePrice: 5000,
    availableForSale: true,
    productStatus: { isAvailable: true },
  } as never);
  vi.mocked(prisma.pichiaStrain.findUnique).mockResolvedValue({
    id: "strain_1",
    name: "Bg11",
    genotype: "his4",
    salePrice: 3000,
  } as never);
  vi.mocked(prisma.product.findUnique).mockResolvedValue({
    id: "prod_1",
    name: "Competent cells kit",
    description: "Kit",
    price: 2000,
    active: true,
  } as never);
});

describe("checkout: order-item persistence (finding #2)", () => {
  it("persists vector, strain, AND generic-product items for a mixed cart", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        items: [
          { productId: "vec_1", productType: "vector", quantity: 1 },
          { productId: "strain_1", productType: "strain", quantity: 1 },
          { productId: "prod_1", productType: "product", quantity: 1 },
        ],
      })
    );

    expect(res.status).toBe(200);
    const data = lastOrderData();
    expect(data.vectorOrderItems.create).toHaveLength(1);
    expect(data.strainOrderItems.create).toHaveLength(1); // was silently dropped before
    expect(data.items.create).toHaveLength(1); // was silently dropped before
    expect(data.subtotal).toBe(5000 + 3000 + 2000);
  });

  it("records strain items with correct quantity and captured price", async () => {
    await POST(
      makeRequest({
        shipping,
        items: [{ productId: "strain_1", productType: "strain", quantity: 3 }],
      })
    );
    const strainItem = lastOrderData().strainOrderItems.create[0];
    expect(strainItem).toMatchObject({
      strainId: "strain_1",
      quantity: 3,
      price: 3000,
    });
    expect(lastOrderData().subtotal).toBe(9000);
  });
});

describe("checkout: server-side shipping recompute (finding #1)", () => {
  beforeEach(() => {
    vi.mocked(getQuotedRates).mockResolvedValue([
      {
        serviceName: "FedEx Ground",
        serviceCode: "fedex_ground",
        carrierCode: "fedex",
        shipmentCost: 25,
        otherCost: 0,
        totalCost: 30, // dollars, handling already applied
      },
    ] as never);
  });

  it("charges the server-quoted price and ignores a tampered client costCents", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
        // Attacker claims shipping costs 1 cent:
        shippingRate: { serviceCode: "fedex_ground", costCents: 1 },
      })
    );

    expect(res.status).toBe(200);
    const data = lastOrderData();
    expect(data.shippingCost).toBe(3000); // 30 USD -> 3000 cents, NOT 1
    expect(data.total).toBe(5000 + 3000);
    expect(data.shippingMethod).toBe("FedEx Ground");

    // Stripe is also charged the recomputed shipping amount.
    const shipLine = lastStripeArgs().line_items.find((li) =>
      li.price_data.product_data.name.startsWith("Shipping:")
    );
    expect(shipLine?.price_data.unit_amount).toBe(3000);
  });

  it("rejects a shipping service code that the server did not quote", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
        shippingRate: { serviceCode: "fedex_free_please", costCents: 0 },
      })
    );

    expect(res.status).toBe(400);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("returns 502 without creating an order if rate lookup fails", async () => {
    vi.mocked(getQuotedRates).mockRejectedValueOnce(new Error("ShipStation down"));
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
        shippingRate: { serviceCode: "fedex_ground", costCents: 1 },
      })
    );

    expect(res.status).toBe(502);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("treats a cart with no shipping selection as $0 shipping", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(200);
    expect(getQuotedRates).not.toHaveBeenCalled();
    expect(lastOrderData().shippingCost).toBe(0);
  });
});

describe("checkout: quantity validation (finding #9)", () => {
  it.each([[0], [-1], [1.5], [1001]])(
    "rejects quantity %s without creating an order",
    async (quantity) => {
      const res = await POST(
        makeRequest({
          shipping,
          items: [{ productId: "vec_1", productType: "vector", quantity }],
        })
      );
      expect(res.status).toBe(400);
      expect(prisma.order.create).not.toHaveBeenCalled();
    }
  );
});
