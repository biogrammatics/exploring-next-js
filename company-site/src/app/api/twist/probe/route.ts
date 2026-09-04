import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { probeOrderEndpoints } from "@/lib/twist";

/**
 * Admin route: discover whether the Twist API exposes order data.
 *
 * Read-only. Must run on Render -- Twist whitelists Render's IPs, so calling
 * this from a local machine returns 401/403 regardless of the path.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await probeOrderEndpoints());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        authTokenSet: !!process.env.TWIST_AUTH_TOKEN,
        endUserTokenSet: !!process.env.TWIST_END_USER_TOKEN,
      },
      { status: 500 }
    );
  }
}
