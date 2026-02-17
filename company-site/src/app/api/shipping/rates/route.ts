import { NextRequest, NextResponse } from "next/server";
import {
  getShippingRates,
  filterCommonRates,
  addHandlingFee,
  type ShippingDestination,
} from "@/lib/shipstation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postalCode, country, state, city } = body as ShippingDestination;

    if (!postalCode || !country) {
      return NextResponse.json(
        { error: "Postal code and country are required" },
        { status: 400 }
      );
    }

    const allRates = await getShippingRates({
      postalCode,
      country,
      state,
      city,
    });

    // Filter to common services and add handling fee
    const filteredRates = filterCommonRates(allRates);
    const ratesWithHandling = addHandlingFee(filteredRates);

    return NextResponse.json({ rates: ratesWithHandling });
  } catch (error) {
    console.error("Shipping rate error:", error);

    // Return a fallback flat rate if ShipStation is unavailable
    return NextResponse.json({
      rates: [],
      fallback: true,
      message: "Unable to calculate shipping rates. Shipping will be calculated separately.",
    });
  }
}
