import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth";

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
  serviceName: string;
  costCents: number;
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

    // Track vector items separately for VectorOrderItem creation
    const vectorItems: { vectorId: string; quantity: number; price: number }[] = [];

    for (const item of items) {
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
      }
    }

    // Add shipping as a line item if selected
    const shippingCostCents = shippingRate?.costCents || 0;
    if (shippingCostCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Shipping: ${shippingRate!.serviceName}`,
          },
          unit_amount: shippingCostCents,
        },
        quantity: 1,
      });
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
        shippingMethod: shippingRate?.serviceName || null,
        // Create vector-specific order items
        vectorOrderItems: {
          create: vectorItems.map((vi) => ({
            vectorId: vi.vectorId,
            quantity: vi.quantity,
            price: vi.price,
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
