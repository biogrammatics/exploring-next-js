"use client";

import { useState } from "react";
import { useCart } from "@/app/components/cart/cart-context";
import { useRouter } from "next/navigation";

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
  };
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  const handleAddToCart = () => {
    addItem({ ...product, type: "product" }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem({ ...product, type: "product" }, quantity);
    router.push("/cart");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label htmlFor="quantity" className="font-medium">
          Quantity:
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleAddToCart}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
            added
              ? "bg-green-500 text-white shadow-lg"
              : "glass-button text-white"
          }`}
        >
          {added ? "Added to Cart!" : "Add to Cart"}
        </button>

        <button
          onClick={handleBuyNow}
          className="flex-1 py-3 px-6 rounded-lg font-medium bg-white/30 backdrop-blur border border-white/40 text-gray-800 hover:bg-white/40 transition-all"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
