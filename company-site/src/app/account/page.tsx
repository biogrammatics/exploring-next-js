import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const orderCount = await prisma.order.count({
    where: { userId: session.user.id },
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Account Details</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="font-medium">{session.user.email}</dd>
            </div>
            {session.user.name && (
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{session.user.name}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Orders</h2>
          <p className="text-gray-600 mb-4">
            You have placed {orderCount} order{orderCount !== 1 ? "s" : ""}.
          </p>
          <Link
            href="/account/orders"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Order History
          </Link>
        </div>
      </div>
    </main>
  );
}
