import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserRole = session?.user?.role;
  const currentUserId = session?.user?.id;
  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          vectorOrderItems: {
            include: { vector: true },
          },
          strainOrderItems: {
            include: { strain: true },
          },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  async function updateRole(formData: FormData) {
    "use server";

    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      throw new Error("Unauthorized: Only Super Admins can change roles");
    }

    const newRole = formData.get("role") as "USER" | "ADMIN" | "SUPER_ADMIN";
    const userId = formData.get("userId") as string;

    // Prevent removing your own Super Admin role
    if (userId === session.user.id && newRole !== "SUPER_ADMIN") {
      throw new Error("You cannot remove your own Super Admin role");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/users");
  }

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const totalSpent = user.orders
    .filter((o) => ["PAID", "SHIPPED", "DELIVERED"].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800",
    SHIPPED: "bg-blue-100 text-blue-800",
    DELIVERED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Admin";
      case "ADMIN":
        return "Admin";
      default:
        return "User";
    }
  };

  const isOwnAccount = currentUserId === user.id;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/users" className="text-blue-600 hover:underline">
          &larr; Back to Users
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">User Details</h1>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd>{user.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Current Role</dt>
              <dd>
                <span
                  className={`px-2 py-1 rounded text-xs ${getRoleBadgeClass(user.role)}`}
                >
                  {getRoleLabel(user.role)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Stats</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Total Orders</dt>
              <dd className="text-2xl font-bold">{user.orders.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Total Spent</dt>
              <dd className="text-2xl font-bold">{formatPrice(totalSpent)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Role Management - Only for Super Admins */}
      {isSuperAdmin && (
        <div className="bg-white border rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Role Management</h2>

          {isOwnAccount && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-yellow-800 text-sm">
                This is your account. You cannot remove your own Super Admin role.
              </p>
            </div>
          )}

          <form action={updateRole} className="flex items-end gap-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Change Role
              </label>
              <select
                name="role"
                defaultValue={user.role}
                className="w-full border rounded-lg px-3 py-2"
                disabled={isOwnAccount && user.role === "SUPER_ADMIN"}
              >
                <option value="USER">User - Standard customer access</option>
                <option value="ADMIN">Admin - Can manage products and orders</option>
                <option value="SUPER_ADMIN">Super Admin - Full access including user roles</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              disabled={isOwnAccount && user.role === "SUPER_ADMIN"}
            >
              Update Role
            </button>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            <p className="font-medium mb-1">Role permissions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>User:</strong> Can browse products, place orders, manage their account</li>
              <li><strong>Admin:</strong> Can manage vectors, strains, orders, and view users</li>
              <li><strong>Super Admin:</strong> All admin permissions plus can change user roles</li>
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Order History</h2>

        {user.orders.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order ID</th>
                <th className="text-left py-2">Items</th>
                <th className="text-left py-2">Total</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user.orders.map((order) => {
                const itemCount = order.vectorOrderItems.length + order.strainOrderItems.length;
                return (
                  <tr key={order.id} className="border-b">
                    <td className="py-2 font-mono text-sm">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="py-2">
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </td>
                    <td className="py-2">{formatPrice(order.total)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          statusColors[order.status] || "bg-gray-100"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
