"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  isSuperAdmin: boolean;
}

export function AdminSidebar({ isSuperAdmin }: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/vectors", label: "Vectors" },
    { href: "/admin/strains", label: "Strains" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/users", label: "Users" },
  ];

  // Check if we're editing a vector or strain
  const vectorEditMatch = pathname.match(/^\/admin\/vectors\/([^/]+)\/edit$/);
  const strainEditMatch = pathname.match(/^\/admin\/strains\/([^/]+)\/edit$/);

  const vectorId = vectorEditMatch?.[1];
  const strainId = strainEditMatch?.[1];

  return (
    <aside className="w-64 bg-gray-50 border-r p-4 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
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
            className={`block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 ${
              pathname === item.href ? "bg-gray-100 font-medium" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Contextual links for vector editing */}
      {vectorId && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500 mb-2">Vector Actions</p>
          <Link
            href={`/admin/vectors/${vectorId}/lots`}
            className="block px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700 text-sm"
          >
            Manage Lots
          </Link>
        </div>
      )}

      {/* Contextual links for strain editing */}
      {strainId && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500 mb-2">Strain Actions</p>
          <Link
            href={`/admin/strains/${strainId}/lots`}
            className="block px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700 text-sm"
          >
            Manage Lots
          </Link>
        </div>
      )}

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
  );
}
