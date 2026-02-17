"use client";

import { useState } from "react";
import { useCart, type CartItemType } from "./cart-context";

interface AddToCartButtonProps {
  productId: string;
  productType: CartItemType;
  name: string;
  price: number; // in cents
  imageUrl: string | null;
  className?: string;
}

export function AddToCartButton({
  productId,
  productType,
  name,
  price,
  imageUrl,
  className = "",
}: AddToCartButtonProps) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);

  const inCart = items.some((item) => item.id === productId);

  const handleClick = () => {
    addItem({
      id: productId,
      type: productType,
      name,
      price,
      imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      onClick={handleClick}
      className={`${className} transition-all duration-200 ${
        added
          ? "bg-green-600 hover:bg-green-700"
          : "glass-button"
      } text-white px-8 py-3 rounded-lg text-lg flex-1`}
    >
      {added ? "Added to Cart!" : inCart ? "Add Another" : "Add to Cart"}
    </button>
  );
}
