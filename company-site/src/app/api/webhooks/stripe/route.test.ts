import { describe, it, expect, vi, beforeEach } from "vitest";

// A single fake transaction client whose methods we can inspect. Declared via
// vi.hoisted so the vi.mock factory (hoisted above imports) can reference it.
const { tx } = vi.hoisted(() => ({
  tx: {
    processedWebhookEvent: { create: vi.fn() },
    order: { updateMany: vi.fn(), findUnique: vi.fn() },
    user: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));

import { POST } from "./route";
import { stripe } from "@/lib/stripe";
import { Prisma } from "@/generated/prisma/client";

function makeRequest(signature: string | null = "sig_test") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "{}",
    headers: signature ? { "stripe-signature": signature } : {},
  }) as unknown as Parameters<typeof POST>[0];
}

/** Make stripe.webhooks.constructEvent return a given event object. */
function stubEvent(event: Record<string, unknown>) {
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(event as never);
}

function lastUpdateManyArg() {
  return vi.mocked(tx.order.updateMany).mock.calls.at(-1)![0] as {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.processedWebhookEvent.create.mockResolvedValue({} as never);
  tx.order.updateMany.mockResolvedValue({ count: 1 } as never);
  tx.order.findUnique.mockResolvedValue({ shippingName: "Ada" } as never);
  tx.user.upsert.mockResolvedValue({ id: "user_new" } as never);
  tx.user.findUnique.mockResolvedValue({ id: "user_1" } as never);
});

describe("stripe webhook: signature", () => {
  it("rejects a request with no signature header", async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(tx.processedWebhookEvent.create).not.toHaveBeenCalled();
  });
});

describe("stripe webhook: idempotency", () => {
  it("acknowledges a replayed event without reprocessing", async () => {
    stubEvent({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", metadata: { orderId: "o1" } } },
    });
    tx.processedWebhookEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "7.2.0",
      })
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("records the event id in the same transaction as its side effects", async () => {
    stubEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          payment_intent: "pi_1",
          customer_details: { email: "a@b.com" },
          metadata: { orderId: "o1", createAccount: "false" },
        },
      },
    });
    await POST(makeRequest());
    expect(tx.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_1", type: "checkout.session.completed" },
    });
  });

  it("returns 500 so Stripe retries when a handler throws", async () => {
    stubEvent({
      id: "evt_err",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          customer_details: { email: "a@b.com" },
          metadata: { orderId: "o1", createAccount: "false" },
        },
      },
    });
    tx.order.updateMany.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

describe("stripe webhook: payment gating", () => {
  it("marks a PENDING order PAID only when payment_status is paid", async () => {
    stubEvent({
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          payment_intent: "pi_1",
          customer_details: { email: "a@b.com" },
          metadata: { orderId: "o1", createAccount: "false" },
        },
      },
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const arg = lastUpdateManyArg();
    expect(arg.where).toMatchObject({ id: "o1", status: "PENDING" });
    expect(arg.data).toMatchObject({
      status: "PAID",
      userId: "user_1",
      stripePaymentIntentId: "pi_1",
    });
  });

  it("does NOT fulfill an unpaid completed session", async () => {
    stubEvent({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "unpaid",
          metadata: { orderId: "o1" },
        },
      },
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(tx.order.updateMany).not.toHaveBeenCalled(); // no fulfillment
    expect(tx.processedWebhookEvent.create).toHaveBeenCalled(); // still recorded
  });

  it("upserts the user when createAccount is true", async () => {
    stubEvent({
      id: "evt_acct",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          customer_details: { email: "new@b.com" },
          metadata: { orderId: "o1", createAccount: "true" },
        },
      },
    });
    await POST(makeRequest());
    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "new@b.com" } })
    );
    expect(lastUpdateManyArg().data).toMatchObject({ userId: "user_new" });
  });

  it("fulfills a delayed async_payment_succeeded the same way", async () => {
    stubEvent({
      id: "evt_async_ok",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          payment_status: "paid",
          metadata: { orderId: "o1", createAccount: "false" },
        },
      },
    });
    await POST(makeRequest());
    expect(lastUpdateManyArg().data).toMatchObject({ status: "PAID" });
  });
});

describe("stripe webhook: lifecycle transitions", () => {
  it("cancels a pending order on session expiry", async () => {
    stubEvent({
      id: "evt_exp",
      type: "checkout.session.expired",
      data: { object: { metadata: { orderId: "o1" } } },
    });
    await POST(makeRequest());
    const arg = lastUpdateManyArg();
    expect(arg.where).toMatchObject({ id: "o1", status: "PENDING" });
    expect(arg.data).toMatchObject({ status: "CANCELLED" });
  });

  it("marks PAYMENT_FAILED on async payment failure", async () => {
    stubEvent({
      id: "evt_async_fail",
      type: "checkout.session.async_payment_failed",
      data: { object: { metadata: { orderId: "o1" } } },
    });
    await POST(makeRequest());
    expect(lastUpdateManyArg().data).toMatchObject({ status: "PAYMENT_FAILED" });
  });

  it("marks REFUNDED on a full charge refund, keyed by payment intent", async () => {
    stubEvent({
      id: "evt_refund",
      type: "charge.refunded",
      data: {
        object: { payment_intent: "pi_1", amount: 5000, amount_refunded: 5000 },
      },
    });
    await POST(makeRequest());
    const arg = lastUpdateManyArg();
    expect(arg.where).toMatchObject({ stripePaymentIntentId: "pi_1" });
    expect(arg.data).toMatchObject({ status: "REFUNDED" });
  });

  it("leaves status unchanged on a partial refund", async () => {
    stubEvent({
      id: "evt_partial",
      type: "charge.refunded",
      data: {
        object: { payment_intent: "pi_1", amount: 5000, amount_refunded: 2000 },
      },
    });
    await POST(makeRequest());
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("marks DISPUTED when a dispute is created", async () => {
    stubEvent({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: { object: { payment_intent: "pi_1" } },
    });
    await POST(makeRequest());
    const arg = lastUpdateManyArg();
    expect(arg.where).toMatchObject({ stripePaymentIntentId: "pi_1" });
    expect(arg.data).toMatchObject({ status: "DISPUTED" });
  });
});
