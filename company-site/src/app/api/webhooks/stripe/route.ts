import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const createAccount = session.metadata?.createAccount === "true";
      const customerEmail = session.customer_details?.email;

      if (orderId && customerEmail) {
        // Check if user exists or needs to be created
        let user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });

        // Create account if requested and user doesn't exist
        if (!user && createAccount) {
          // Get shipping info from the order to populate profile
          const order = await prisma.order.findUnique({
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

          user = await prisma.user.create({
            data: {
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
          });
        }

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "PAID",
            customerEmail,
            ...(user && { userId: user.id }),
          },
        });
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
