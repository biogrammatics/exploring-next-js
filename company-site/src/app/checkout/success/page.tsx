import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function CheckoutSuccessPage() {
  const session = await auth();

  return (
    <main className="container mx-auto px-4 py-16 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-green-500 text-6xl mb-4">&#10003;</div>
        <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
        <p className="text-gray-600 mb-8">
          Thank you for your purchase. You will receive a confirmation email shortly.
        </p>

        <div className="space-y-4">
          {session ? (
            <Link
              href="/account/orders"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
            >
              View Your Orders
            </Link>
          ) : (
            <>
              <p className="text-gray-600">
                Sign in to view your order history and track your orders.
              </p>
              <Link
                href="/auth/signin"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
              >
                Sign In
              </Link>
            </>
          )}

          <div>
            <Link
              href="/products"
              className="inline-block text-gray-600 hover:text-gray-900 underline"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
