import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { Prisma } from "@/generated/prisma/client";
import Stripe from "stripe";

type Tx = Prisma.TransactionClient;

/**
 * Fulfill an order once Stripe confirms payment. Used for both the synchronous
 * `checkout.session.completed` (card) and the delayed
 * `checkout.session.async_payment_succeeded` (ACH, etc.) events.
 */
async function handlePaidSession(tx: Tx, session: Stripe.Checkout.Session) {
  // Do not fulfill until payment actually succeeded. For asynchronous payment
  // methods, `checkout.session.completed` arrives with payment_status "unpaid"
  // and fulfillment happens later on async_payment_succeeded.
  if (session.payment_status !== "paid") {
    return;
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const createAccount = session.metadata?.createAccount === "true";
  const customerEmail = session.customer_details?.email ?? undefined;

  // Resolve (or create) the user without a check-then-create race: upsert.
  let userId: string | undefined;
  if (customerEmail) {
    if (createAccount) {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          shippingName: true,
          shippingPhone: true,
          shippingAddress1: true,
          shippingAddress2: true,
          shippingCity: true,
          shippingState: true,
          shippingZip: true,
          shippingCountry: true,
        },
      });
      const user = await tx.user.upsert({
        where: { email: customerEmail },
        update: {},
        create: {
          email: customerEmail,
          name: order?.shippingName,
          phone: order?.shippingPhone,
          address1: order?.shippingAddress1,
          address2: order?.shippingAddress2,
          city: order?.shippingCity,
          state: order?.shippingState,
          zip: order?.shippingZip,
          country: order?.shippingCountry,
        },
        select: { id: true },
      });
      userId = user.id;
    } else {
      const existing = await tx.user.findUnique({
        where: { email: customerEmail },
        select: { id: true },
      });
      userId = existing?.id;
    }
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : undefined;

  // Conditional transition: only a still-PENDING order becomes PAID. This keeps
  // a replayed or out-of-order event from resurrecting an order that was already
  // cancelled, refunded, or advanced past PAID.
  await tx.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: {
      status: "PAID",
      orderedAt: new Date(),
      ...(customerEmail && { customerEmail }),
      ...(userId && { userId }),
      ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
    },
  });
}

/** A checkout session expired without payment — cancel the pending order. */
async function handleExpiredSession(tx: Tx, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  await tx.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

/** An asynchronous payment (e.g. ACH) failed after checkout. */
async function handleAsyncPaymentFailed(
  tx: Tx,
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  await tx.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "PAYMENT_FAILED" },
  });
}

/** A charge was refunded — mark the matching order refunded on a FULL refund. */
async function handleChargeRefunded(tx: Tx, charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : undefined;
  if (!paymentIntentId) return;

  // Only a full refund flips the order to REFUNDED; partial refunds are left to
  // manual review so we do not misrepresent a still-partially-paid order.
  const fullyRefunded = charge.amount_refunded >= charge.amount;
  if (!fullyRefunded) {
    console.warn(
      `Partial refund on payment_intent ${paymentIntentId} (${charge.amount_refunded}/${charge.amount}) — left for manual review`
    );
    return;
  }

  await tx.order.updateMany({
    where: { stripePaymentIntentId: paymentIntentId, status: { not: "REFUNDED" } },
    data: { status: "REFUNDED" },
  });
}

/** A dispute (chargeback) was opened against a charge. */
async function handleDisputeCreated(tx: Tx, dispute: Stripe.Dispute) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : undefined;
  if (!paymentIntentId) return;

  await tx.order.updateMany({
    where: { stripePaymentIntentId: paymentIntentId, status: { not: "DISPUTED" } },
    data: { status: "DISPUTED" },
  });
}

/** Route a verified Stripe event to the appropriate handler. */
async function dispatchEvent(tx: Tx, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handlePaidSession(tx, event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
      await handleAsyncPaymentFailed(
        tx,
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "checkout.session.expired":
      await handleExpiredSession(
        tx,
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case "charge.refunded":
      await handleChargeRefunded(tx, event.data.object as Stripe.Charge);
      break;
    case "charge.dispute.created":
      await handleDisputeCreated(tx, event.data.object as Stripe.Dispute);
      break;
    default:
      // Unhandled event types are acknowledged (recorded + 200) so Stripe stops
      // retrying them.
      break;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    // Idempotency + atomicity: record the event id and apply its side effects
    // in one transaction. A replayed event fails the unique insert (P2002); a
    // failed handler rolls back the ledger entry so Stripe's retry can reprocess.
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
      await dispatchEvent(tx, event);
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already processed — acknowledge so Stripe stops retrying.
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Webhook handler error:", err);
    // 500 tells Stripe to retry later.
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
