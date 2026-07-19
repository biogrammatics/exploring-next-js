import { describe, it, expect } from "vitest";
import { addHandlingFee, filterCommonRates, type ShippingRate } from "./shipstation";

function rate(overrides: Partial<ShippingRate>): ShippingRate {
  return {
    serviceName: "FedEx Ground",
    serviceCode: "fedex_ground",
    carrierCode: "fedex",
    shipmentCost: 10,
    otherCost: 0,
    totalCost: 10,
    ...overrides,
  };
}

describe("addHandlingFee", () => {
  it("adds the default $5 handling fee and rounds up to the nearest dollar", () => {
    const [r] = addHandlingFee([rate({ totalCost: 12.1 })]);
    // 12.1 + 5 = 17.1 -> ceil -> 18
    expect(r.totalCost).toBe(18);
  });

  it("rounds a whole-dollar result to itself (no phantom rounding up)", () => {
    const [r] = addHandlingFee([rate({ totalCost: 10 })]);
    // 10 + 5 = 15 exactly
    expect(r.totalCost).toBe(15);
  });

  it("respects a custom handling fee", () => {
    const [r] = addHandlingFee([rate({ totalCost: 20 })], 7.5);
    // 20 + 7.5 = 27.5 -> ceil -> 28
    expect(r.totalCost).toBe(28);
  });

  it("does not mutate the input rate objects", () => {
    const input = rate({ totalCost: 10 });
    addHandlingFee([input]);
    expect(input.totalCost).toBe(10);
  });
});

describe("filterCommonRates", () => {
  it("keeps only recognized common FedEx services", () => {
    const rates = [
      rate({ serviceCode: "fedex_ground" }),
      rate({ serviceCode: "fedex_some_obscure_service" }),
      rate({ serviceCode: "fedex_priority_overnight" }),
    ];
    const filtered = filterCommonRates(rates);
    expect(filtered.map((r) => r.serviceCode)).toEqual([
      "fedex_ground",
      "fedex_priority_overnight",
    ]);
  });

  it("falls back to all rates when none match the common list", () => {
    const rates = [
      rate({ serviceCode: "fedex_weird_a" }),
      rate({ serviceCode: "fedex_weird_b" }),
    ];
    expect(filterCommonRates(rates)).toHaveLength(2);
  });
});
