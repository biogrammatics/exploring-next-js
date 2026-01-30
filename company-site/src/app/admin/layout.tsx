import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/app/components/admin/admin-sidebar";

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

  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      <AdminSidebar isSuperAdmin={isSuperAdmin} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
