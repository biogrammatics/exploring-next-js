import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/app/components/account/profile-form";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      address1: true,
      address2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
    },
  });

  if (!user) {
    redirect("/auth/signin");
  }

  const orderCount = await prisma.order.count({
    where: { userId: session.user.id },
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Profile</h2>
            <ProfileForm user={user} />
          </div>
        </div>

        <div>
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
      </div>
    </main>
  );
}
