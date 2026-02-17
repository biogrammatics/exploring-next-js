"use client";

import Link from "next/link";
import { useCart } from "@/app/components/cart/cart-context";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white drop-shadow-lg">Shopping Cart</h1>
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
      <h1 className="text-3xl font-bold mb-8 text-white drop-shadow-lg">Shopping Cart</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="glass-panel divide-y divide-white/20">
            {items.map((item) => (
              <div key={item.id} className="p-4 flex gap-4">
                {item.imageUrl && (
                  <div className="w-24 h-24 flex-shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-gray-600">{formatPrice(item.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <label htmlFor={`qty-${item.id}`} className="text-sm text-gray-500">
                      Qty:
                    </label>
                    <select
                      id={`qty-${item.id}`}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                      className="border rounded px-2 py-1"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700 text-sm ml-4"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="glass-panel p-6 sticky top-20">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Order Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-500">Calculated at checkout</span>
              </div>
            </div>
            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="block w-full glass-button text-white text-center py-3 rounded-lg font-medium"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/vectors"
              className="block w-full text-center py-3 text-gray-600 hover:text-gray-900 mt-2"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
