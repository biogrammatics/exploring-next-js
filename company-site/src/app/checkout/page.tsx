"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCart } from "@/app/components/cart/cart-context";

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

interface ShippingRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
  totalCost: number;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);

  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });

  // Shipping rates
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesFallback, setRatesFallback] = useState(false);

  // Fetch user profile if logged in
  useEffect(() => {
    if (session?.user) {
      fetch("/api/account/profile")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setAddress({
              name: data.name || "",
              email: session.user.email || "",
              phone: data.phone || "",
              address1: data.address1 || "",
              address2: data.address2 || "",
              city: data.city || "",
              state: data.state || "",
              zip: data.zip || "",
              country: data.country || "US",
            });
          }
        })
        .catch(() => {});
    }
  }, [session]);

  // Fetch shipping rates when zip + country are filled
  const fetchShippingRates = useCallback(async () => {
    if (!address.zip || !address.country) return;

    setRatesLoading(true);
    setRatesFallback(false);

    try {
      const response = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: address.zip,
          country: address.country,
          state: address.state,
          city: address.city,
        }),
      });

      const data = await response.json();

      if (data.fallback) {
        setRatesFallback(true);
        setShippingRates([]);
        setSelectedRate(null);
      } else if (data.rates && data.rates.length > 0) {
        setShippingRates(data.rates);
        // Auto-select cheapest rate
        setSelectedRate(data.rates[0]);
      } else {
        setShippingRates([]);
        setSelectedRate(null);
      }
    } catch {
      setRatesFallback(true);
      setShippingRates([]);
      setSelectedRate(null);
    } finally {
      setRatesLoading(false);
    }
  }, [address.zip, address.country, address.state, address.city]);

  // Debounce shipping rate fetch
  useEffect(() => {
    if (address.zip && address.zip.length >= 3 && address.country) {
      const timer = setTimeout(fetchShippingRates, 800);
      return () => clearTimeout(timer);
    }
  }, [address.zip, address.country, address.state, address.city, fetchShippingRates]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDollars = (dollars: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(dollars);
  };

  const shippingCostCents = selectedRate
    ? Math.round(selectedRate.totalCost * 100)
    : 0;
  const grandTotal = total + shippingCostCents;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            productType: item.type,
            quantity: item.quantity,
          })),
          shipping: address,
          shippingRate: selectedRate
            ? {
                serviceCode: selectedRate.serviceCode,
                serviceName: selectedRate.serviceName,
                costCents: shippingCostCents,
              }
            : null,
          createAccount: !session && createAccount,
        }),
      });

      const data = await response.json();

      if (data.url) {
        clearCart();
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white drop-shadow-lg">
          Checkout
        </h1>
        <div className="glass-panel text-center py-12">
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <Link
            href="/vectors"
            className="inline-block glass-button text-white px-6 py-2 rounded-lg"
          >
            Browse Vectors
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white drop-shadow-lg">
        Checkout
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Account Section */}
            {!session && status !== "loading" && (
              <div className="glass-panel p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Account
                </h2>
                <p className="text-gray-600 mb-4">
                  Already have an account?{" "}
                  <Link
                    href="/auth/signin?callbackUrl=/checkout"
                    className="text-blue-600 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  for faster checkout.
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-gray-700">
                    Create an account for future purchases
                  </span>
                </label>
              </div>
            )}

            {session && (
              <div className="glass-panel p-6 bg-green-50/80">
                <p className="text-green-800">
                  Signed in as <strong>{session.user.email}</strong>
                </p>
              </div>
            )}

            {/* Contact Information */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Contact Information
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={address.email}
                    onChange={handleChange}
                    required
                    disabled={!!session}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={address.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={address.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Shipping Address
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="address1"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    id="address1"
                    name="address1"
                    value={address.address1}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    htmlFor="address2"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    id="address2"
                    name="address2"
                    value={address.address2}
                    onChange={handleChange}
                    placeholder="Apt, suite, unit, etc. (optional)"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={address.city}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    State / Province *
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={address.state}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="zip"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    ZIP / Postal Code *
                  </label>
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    value={address.zip}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Country *
                  </label>
                  <select
                    id="country"
                    name="country"
                    value={address.country}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="AU">Australia</option>
                    <option value="JP">Japan</option>
                    <option value="CN">China</option>
                    <option value="KR">South Korea</option>
                    <option value="IN">India</option>
                    <option value="BR">Brazil</option>
                    <option value="MX">Mexico</option>
                    <option value="CH">Switzerland</option>
                    <option value="NL">Netherlands</option>
                    <option value="SE">Sweden</option>
                    <option value="DK">Denmark</option>
                    <option value="NO">Norway</option>
                    <option value="SG">Singapore</option>
                    <option value="IL">Israel</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Shipping Method */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Shipping Method
              </h2>

              {ratesLoading && (
                <div className="flex items-center gap-2 text-gray-500 py-4">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Calculating shipping rates...
                </div>
              )}

              {!ratesLoading && ratesFallback && (
                <p className="text-gray-500 py-4">
                  Shipping rates unavailable. Shipping will be calculated
                  separately.
                </p>
              )}

              {!ratesLoading &&
                !ratesFallback &&
                shippingRates.length === 0 &&
                (!address.zip || address.zip.length < 3) && (
                  <p className="text-gray-500 py-4">
                    Enter your shipping address to see available rates.
                  </p>
                )}

              {!ratesLoading &&
                !ratesFallback &&
                shippingRates.length === 0 &&
                address.zip &&
                address.zip.length >= 3 && (
                  <p className="text-gray-500 py-4">
                    No shipping rates available for this destination.
                  </p>
                )}

              {!ratesLoading && shippingRates.length > 0 && (
                <div className="space-y-2">
                  {shippingRates.map((rate) => (
                    <label
                      key={rate.serviceCode}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRate?.serviceCode === rate.serviceCode
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingRate"
                          value={rate.serviceCode}
                          checked={
                            selectedRate?.serviceCode === rate.serviceCode
                          }
                          onChange={() => setSelectedRate(rate)}
                          className="text-blue-600"
                        />
                        <span className="font-medium text-gray-800">
                          {rate.serviceName}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {formatDollars(rate.totalCost)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="glass-panel p-6 sticky top-20">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">
                Order Summary
              </h2>
              <div className="divide-y divide-gray-200 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="text-gray-800">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-800">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  {selectedRate ? (
                    <span className="text-gray-800">
                      {formatDollars(selectedRate.totalCost)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">
                      {ratesLoading ? "Calculating..." : "Select above"}
                    </span>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4 mb-6">
                <div className="flex justify-between font-semibold text-lg">
                  <span className="text-gray-800">Total</span>
                  <span className="text-gray-800">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || (!selectedRate && !ratesFallback)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Processing..." : "Continue to Payment"}
              </button>
              <Link
                href="/cart"
                className="block w-full text-center py-3 text-gray-600 hover:text-gray-900 mt-2"
              >
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
