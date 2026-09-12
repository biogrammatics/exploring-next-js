import { requireAdminPage, isSuperAdminRole } from "@/lib/auth-guards";
import { AdminSidebar } from "@/app/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();
  const isSuperAdmin = isSuperAdminRole(session.user.role);

  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      <AdminSidebar isSuperAdmin={isSuperAdmin} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
