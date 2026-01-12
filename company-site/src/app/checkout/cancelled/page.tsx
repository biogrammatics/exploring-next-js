import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <main className="container mx-auto px-4 py-16 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-gray-400 text-6xl mb-4">&#10005;</div>
        <h1 className="text-3xl font-bold mb-4">Checkout Cancelled</h1>
        <p className="text-gray-600 mb-8">
          Your order was cancelled. No payment has been made.
        </p>
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
        >
          Back to Products
        </Link>
      </div>
    </main>
  );
}
