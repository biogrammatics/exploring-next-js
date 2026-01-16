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

  // Get counts for dashboard summary
  const [vectorCount, strainCount, projectCount] = await Promise.all([
    prisma.vectorOrderItem.count({
      where: {
        order: {
          userId: session.user.id,
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
    }),
    prisma.strainOrderItem.count({
      where: {
        order: {
          userId: session.user.id,
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
    }),
    prisma.customProject.count({
      where: { userId: session.user.id },
    }),
  ]);

  const totalItems = vectorCount + strainCount + projectCount;

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold mb-8 text-white drop-shadow-lg">My Account</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-800">Profile</h2>
              <ProfileForm user={user} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Team Access</h2>
              <p className="text-gray-600 text-sm mb-4">
                Allow colleagues to access your account using their own email addresses.
              </p>
              <Link
                href="/account/team"
                className="inline-block w-full text-center bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
              >
                Manage Team Access
              </Link>
            </div>

            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">My Dashboard</h2>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Vectors</span>
                  <span className="font-medium">{vectorCount}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Strains</span>
                  <span className="font-medium">{strainCount}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Custom Projects</span>
                  <span className="font-medium">{projectCount}</span>
                </div>
              </div>
              <Link
                href="/account/dashboard"
                className="inline-block w-full text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
