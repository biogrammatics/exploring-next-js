"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/components/cart/cart-context";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
};

export function ProductCard({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      id: product.id,
      type: "product",
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <Link
      href={`/products/${product.id}`}
      className="block glass-card overflow-hidden"
    >
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">{product.name}</h2>
        {product.description && (
          <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-800">{formatPrice(product.price)}</span>
          <button
            onClick={handleAddToCart}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              added
                ? "bg-green-500 text-white shadow-lg"
                : "glass-button text-white"
            }`}
          >
            {added ? "Added!" : "Add to Cart"}
          </button>
        </div>
      </div>
    </Link>
  );
}
