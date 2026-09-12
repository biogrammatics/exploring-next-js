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
import { SHIPPING_PENDING_QUOTE } from "@/lib/order-status";

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

/** A valid service selection matching the default getQuotedRates mock. */
const groundRate = { serviceCode: "fedex_ground", costCents: 3000 };

type CreatedItems = { create: Array<Record<string, unknown>> };
type OrderData = {
  customerEmail: string;
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
  customer_email: string;
  line_items: Array<{
    price_data: { unit_amount: number; product_data: { name: string } };
  }>;
  metadata: Record<string, string>;
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

  // Carrier is reachable and quotes one service by default.
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

  vi.mocked(prisma.vector.findUnique).mockResolvedValue({
    id: "vec_1",
    name: "pJAN",
    description: "Expression vector",
    salePrice: 5000,
    availableForSale: true,
    isPublic: true,
    productStatus: { isAvailable: true },
  } as never);
  vi.mocked(prisma.pichiaStrain.findUnique).mockResolvedValue({
    id: "strain_1",
    name: "Bg11",
    genotype: "his4",
    salePrice: 3000,
    isPublic: true,
    productStatus: { isAvailable: true },
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
        shippingRate: groundRate,
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
        shippingRate: groundRate,
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
    expect(lastStripeArgs().metadata.shippingPending).toBe("false");
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

  it("returns 502 without creating an order if rate lookup fails for a selected service", async () => {
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

  // Shipping is never client-optional: omitting `shippingRate` used to yield a
  // $0 shipping order. The server now quotes the carrier itself.
  it("rejects a cart with no shipping selection when the carrier quotes rates", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please select a shipping method" });
    expect(getQuotedRates).toHaveBeenCalledTimes(1);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("ignores a client ratesFallback flag when rates are actually available", async () => {
    const res = await POST(
      makeRequest({
        shipping,
        ratesFallback: true,
        shippingRate: null,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("accepts a no-selection cart when the carrier is down, flagging shipping as pending", async () => {
    vi.mocked(getQuotedRates).mockRejectedValueOnce(new Error("ShipStation down"));
    const res = await POST(
      makeRequest({
        shipping,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );

    expect(res.status).toBe(200);
    const data = lastOrderData();
    expect(data.shippingMethod).toBe(SHIPPING_PENDING_QUOTE);
    expect(data.shippingCost).toBe(0);
    expect(data.total).toBe(5000);
    expect(lastStripeArgs().metadata.shippingPending).toBe("true");
    // No bogus $0 shipping line on the Stripe session.
    expect(
      lastStripeArgs().line_items.some((li) =>
        li.price_data.product_data.name.startsWith("Shipping:")
      )
    ).toBe(false);
  });

  it("requires a destination before quoting", async () => {
    const res = await POST(
      makeRequest({
        shipping: { ...shipping, zip: "", country: "" },
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
    expect(getQuotedRates).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});

describe("checkout: product visibility", () => {
  it("rejects a vector that is not public even if it is for sale and priced", async () => {
    vi.mocked(prisma.vector.findUnique).mockResolvedValue({
      id: "vec_hidden",
      name: "pSecret",
      salePrice: 5000,
      availableForSale: true,
      isPublic: false,
      productStatus: { isAvailable: true },
    } as never);
    const res = await POST(
      makeRequest({
        shipping,
        shippingRate: groundRate,
        items: [{ productId: "vec_hidden", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("rejects a strain whose product status is unavailable", async () => {
    vi.mocked(prisma.pichiaStrain.findUnique).mockResolvedValue({
      id: "strain_1",
      name: "Bg11",
      salePrice: 3000,
      isPublic: true,
      productStatus: { isAvailable: false },
    } as never);
    const res = await POST(
      makeRequest({
        shipping,
        shippingRate: groundRate,
        items: [{ productId: "strain_1", productType: "strain", quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});

describe("checkout: customer email", () => {
  it("rejects a malformed email", async () => {
    const res = await POST(
      makeRequest({
        shipping: { ...shipping, email: "not-an-email" },
        shippingRate: groundRate,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("normalizes the email before persisting and passing to Stripe", async () => {
    const res = await POST(
      makeRequest({
        shipping: { ...shipping, email: "  Ada@Example.COM " },
        shippingRate: groundRate,
        items: [{ productId: "vec_1", productType: "vector", quantity: 1 }],
      })
    );
    expect(res.status).toBe(200);
    expect(lastOrderData().customerEmail).toBe("ada@example.com");
    expect(lastStripeArgs().customer_email).toBe("ada@example.com");
  });
});

describe("checkout: quantity validation (finding #9)", () => {
  it.each([[0], [-1], [1.5], [1001]])(
    "rejects quantity %s without creating an order",
    async (quantity) => {
      const res = await POST(
        makeRequest({
          shipping,
          shippingRate: groundRate,
          items: [{ productId: "vec_1", productType: "vector", quantity }],
        })
      );
      expect(res.status).toBe(400);
      expect(prisma.order.create).not.toHaveBeenCalled();
    }
  );
});
