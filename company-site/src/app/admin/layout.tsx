import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  if (!session || !isAdmin) {
    redirect("/");
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/vectors", label: "Vectors" },
    { href: "/admin/strains", label: "Strains" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      <aside className="w-64 bg-gray-50 border-r p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Admin</h2>
          <p className="text-xs text-gray-500">
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {isSuperAdmin && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">Super Admin</p>
            <Link
              href="/admin/users"
              className="block px-3 py-2 rounded-lg hover:bg-red-50 text-red-700 text-sm"
            >
              Manage Roles
            </Link>
          </div>
        )}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
