import { prisma } from "@/lib/db";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function AdminUsersPage() {
  const session = await auth();
  const currentUserRole = session?.user?.role;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
    }).format(date);
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Users</h1>

      {currentUserRole !== "SUPER_ADMIN" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            You can view users but only Super Admins can change user roles.
          </p>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Role</th>
              <th className="text-left py-3 px-4">Orders</th>
              <th className="text-left py-3 px-4">Joined</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">{user.name || "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${getRoleBadgeClass(user.role)}`}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="py-3 px-4">{user._count.orders}</td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
