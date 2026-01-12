import { auth, signOut } from "@/lib/auth";
import Link from "next/link";

export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">{session.user.email}</span>

      <Link
        href="/account"
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Account
      </Link>

      {session.user.role === "ADMIN" && (
        <Link
          href="/admin"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Admin
        </Link>
      )}

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
