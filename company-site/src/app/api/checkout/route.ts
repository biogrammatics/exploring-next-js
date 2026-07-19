import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { getQuotedRates } from "@/lib/shipstation";

const MAX_QUANTITY_PER_ITEM = 1000;

interface ShippingAddress {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface CheckoutItem {
  productId: string;
  productType: "vector" | "strain" | "product";
  quantity: number;
}

interface ShippingRateInfo {
  serviceCode: string;
  // serviceName and costCents may be sent by the client for display purposes
  // but are NOT trusted — the authoritative price is recomputed server-side
  // from serviceCode against the shipping destination.
  serviceName?: string;
  costCents?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const { items, shipping, shippingRate, createAccount } =
      (await request.json()) as {
        items: CheckoutItem[];
        shipping?: ShippingAddress;
        shippingRate?: ShippingRateInfo | null;
        createAccount?: boolean;
      };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    if (!shipping?.email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Build Stripe line items by looking up each product type
    type StripeLineItem = {
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    };

    const lineItems: StripeLineItem[] = [];
    let subtotal = 0;

    // Track each product type separately so every charged item is persisted as
    // its corresponding order-item record (not just vectors).
    const vectorItems: { vectorId: string; quantity: number; price: number }[] = [];
    const strainItems: { strainId: string; quantity: number; price: number }[] = [];
    const productItems: { productId: string; quantity: number; price: number }[] = [];

    for (const item of items) {
      // Reject non-positive / non-integer / absurd quantities before they can
      // corrupt the subtotal.
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY_PER_ITEM
      ) {
        return NextResponse.json(
          { error: `Invalid quantity for item "${item.productId}"` },
          { status: 400 }
        );
      }

      if (item.productType === "vector") {
        const vector = await prisma.vector.findUnique({
          where: { id: item.productId },
          include: { productStatus: true },
        });

        if (!vector || !vector.availableForSale || !vector.salePrice) {
          return NextResponse.json(
            {
              error: `Vector "${vector?.name || item.productId}" is not available for sale`,
            },
            { status: 400 }
          );
        }

        if (!vector.productStatus?.isAvailable) {
          return NextResponse.json(
            { error: `Vector "${vector.name}" is not currently available` },
            { status: 400 }
          );
        }

        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: vector.name,
              description: vector.description || undefined,
            },
            unit_amount: vector.salePrice,
          },
          quantity: item.quantity,
        });

        subtotal += vector.salePrice * item.quantity;
        vectorItems.push({
          vectorId: vector.id,
          quantity: item.quantity,
          price: vector.salePrice,
        });
      } else if (item.productType === "strain") {
        const strain = await prisma.pichiaStrain.findUnique({
          where: { id: item.productId },
        });

        if (!strain || !strain.salePrice) {
          return NextResponse.json(
            {
              error: `Strain "${strain?.name || item.productId}" is not available`,
            },
            { status: 400 }
          );
        }

        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: strain.name,
              description: strain.genotype || undefined,
            },
            unit_amount: strain.salePrice,
          },
          quantity: item.quantity,
        });

        subtotal += strain.salePrice * item.quantity;
        strainItems.push({
          strainId: strain.id,
          quantity: item.quantity,
          price: strain.salePrice,
        });
      } else {
        // Fallback to generic Product model
        const product = await prisma.product.findUnique({
          where: { id: item.productId, active: true },
        });

        if (!product) {
          return NextResponse.json(
            { error: `Product "${item.productId}" not found or inactive` },
            { status: 400 }
          );
        }

        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description || undefined,
            },
            unit_amount: product.price,
          },
          quantity: item.quantity,
        });

        subtotal += product.price * item.quantity;
        productItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
        });
      }
    }

    // Recompute shipping server-side. The client only tells us WHICH service
    // it selected (serviceCode); the price is re-derived from ShipStation for
    // the submitted destination so a tampered `costCents` cannot reduce the
    // shipping charge.
    let shippingCostCents = 0;
    let shippingServiceName: string | null = null;

    if (shippingRate?.serviceCode) {
      if (!shipping.zip || !shipping.country) {
        return NextResponse.json(
          { error: "A shipping address is required to calculate shipping" },
          { status: 400 }
        );
      }

      let quotedRates;
      try {
        quotedRates = await getQuotedRates({
          postalCode: shipping.zip,
          country: shipping.country,
          state: shipping.state,
          city: shipping.city,
        });
      } catch (err) {
        console.error("Server-side shipping recalculation failed:", err);
        return NextResponse.json(
          { error: "Unable to verify shipping rates. Please try again." },
          { status: 502 }
        );
      }

      const matched = quotedRates.find(
        (r) => r.serviceCode === shippingRate.serviceCode
      );
      if (!matched) {
        return NextResponse.json(
          {
            error:
              "The selected shipping method is no longer available. Please reselect a shipping option.",
          },
          { status: 400 }
        );
      }

      // Handling fee already applied in getQuotedRates; totalCost is a whole
      // number of dollars.
      shippingCostCents = Math.round(matched.totalCost * 100);
      shippingServiceName = matched.serviceName;

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Shipping: ${shippingServiceName}`,
          },
          unit_amount: shippingCostCents,
        },
        quantity: 1,
      });
    }

    // Defense-in-depth: the persisted item prices must sum to the subtotal we
    // charge. These are built from the same values, so a mismatch means a code
    // bug — fail closed rather than charge an amount we can't account for.
    const persistedSubtotal =
      vectorItems.reduce((s, i) => s + i.price * i.quantity, 0) +
      strainItems.reduce((s, i) => s + i.price * i.quantity, 0) +
      productItems.reduce((s, i) => s + i.price * i.quantity, 0);
    if (persistedSubtotal !== subtotal) {
      console.error(
        `Checkout subtotal mismatch: charged ${subtotal}, persisted ${persistedSubtotal}`
      );
      return NextResponse.json(
        { error: "Order total could not be verified. Please try again." },
        { status: 500 }
      );
    }

    const totalAmount = subtotal + shippingCostCents;

    // Create pending order
    const order = await prisma.order.create({
      data: {
        customerEmail: shipping.email,
        userId: session?.user?.id || null,
        subtotal,
        shippingCost: shippingCostCents,
        total: totalAmount,
        shippingName: shipping.name,
        shippingPhone: shipping.phone,
        shippingAddress1: shipping.address1,
        shippingAddress2: shipping.address2,
        shippingCity: shipping.city,
        shippingState: shipping.state,
        shippingZip: shipping.zip,
        shippingCountry: shipping.country,
        shippingMethod: shippingServiceName,
        // Persist every charged item as its corresponding order-item record.
        vectorOrderItems: {
          create: vectorItems.map((vi) => ({
            vectorId: vi.vectorId,
            quantity: vi.quantity,
            price: vi.price,
          })),
        },
        strainOrderItems: {
          create: strainItems.map((si) => ({
            strainId: si.strainId,
            quantity: si.quantity,
            price: si.price,
          })),
        },
        items: {
          create: productItems.map((pi) => ({
            productId: pi.productId,
            quantity: pi.quantity,
            price: pi.price,
          })),
        },
      },
    });

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancelled`,
      customer_email: shipping.email,
      metadata: {
        orderId: order.id,
        createAccount: createAccount ? "true" : "false",
      },
    });

    // Update order with session ID
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: stripeSession.id },
    });

    return NextResponse.json({
      sessionId: stripeSession.id,
      url: stripeSession.url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
