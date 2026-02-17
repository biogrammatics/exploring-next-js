// ShipStation V2 API client for shipping rate calculation
// Docs: https://docs.shipstation.com/openapi/rates

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY || "";
const SHIPSTATION_BASE_URL = "https://ssapi.shipstation.com";

// BioGrammatics ship-from address (Carlsbad, CA)
export const SHIP_FROM = {
  postalCode: "92011",
  country: "US",
  state: "CA",
  city: "Carlsbad",
};

// Default package for vectors: FedEx envelope
const DEFAULT_WEIGHT = {
  value: 8, // ounces - typical vector shipment
  units: "ounces" as const,
};

export interface ShippingRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number; // in dollars
  otherCost: number; // surcharges in dollars
  totalCost: number; // shipmentCost + otherCost
}

export interface ShippingDestination {
  postalCode: string;
  country: string;
  state?: string;
  city?: string;
  residential?: boolean;
}

/**
 * Get shipping rates from ShipStation V1 API for a given destination.
 * Uses FedEx carrier with standard envelope package.
 */
export async function getShippingRates(
  destination: ShippingDestination
): Promise<ShippingRate[]> {
  if (!SHIPSTATION_API_KEY) {
    throw new Error("SHIPSTATION_API_KEY is not configured");
  }

  // ShipStation V1 API requires one request per carrier
  // We default to FedEx for all shipments
  const carrierCode = destination.country === "US" ? "fedex" : "fedex";

  const requestBody = {
    carrierCode,
    fromPostalCode: SHIP_FROM.postalCode,
    toCountry: destination.country,
    toPostalCode: destination.postalCode,
    toState: destination.state || "",
    toCity: destination.city || "",
    weight: DEFAULT_WEIGHT,
    confirmation: "none",
    residential: destination.residential ?? false,
  };

  // ShipStation V1 uses Basic Auth: base64(apiKey:apiSecret)
  // The API key format is "key:secret" - we encode the whole thing
  const authHeader = `Basic ${Buffer.from(SHIPSTATION_API_KEY).toString("base64")}`;

  const response = await fetch(`${SHIPSTATION_BASE_URL}/shipments/getrates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("ShipStation API error:", response.status, error);
    throw new Error(`ShipStation API error: ${response.status}`);
  }

  const rates = await response.json();

  // Map and sort rates by total cost
  const mappedRates: ShippingRate[] = rates.map(
    (rate: { serviceName: string; serviceCode: string; shipmentCost: number; otherCost: number }) => ({
      serviceName: rate.serviceName,
      serviceCode: rate.serviceCode,
      carrierCode,
      shipmentCost: rate.shipmentCost,
      otherCost: rate.otherCost,
      totalCost: rate.shipmentCost + rate.otherCost,
    })
  );

  // Sort cheapest to most expensive
  return mappedRates.sort((a, b) => a.totalCost - b.totalCost);
}

/**
 * Filter rates to only include commonly used FedEx services.
 * Removes obscure or business-specific services.
 */
export function filterCommonRates(rates: ShippingRate[]): ShippingRate[] {
  const commonServices = [
    "fedex_ground",
    "fedex_home_delivery",
    "fedex_2day",
    "fedex_2day_am",
    "fedex_express_saver",
    "fedex_standard_overnight",
    "fedex_priority_overnight",
    "fedex_first_overnight",
    "fedex_international_economy",
    "fedex_international_priority",
    "fedex_international_ground",
  ];

  const filtered = rates.filter((rate) =>
    commonServices.includes(rate.serviceCode)
  );

  // If no common services matched, return all rates
  return filtered.length > 0 ? filtered : rates;
}

/**
 * Add a handling fee to shipping rates and round up to nearest dollar.
 */
export function addHandlingFee(
  rates: ShippingRate[],
  handlingFee: number = 5.0
): ShippingRate[] {
  return rates.map((rate) => {
    const rawTotal = rate.totalCost + handlingFee;
    const roundedTotal = Math.ceil(rawTotal); // Round up to nearest dollar
    return {
      ...rate,
      totalCost: roundedTotal,
    };
  });
}
