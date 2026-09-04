import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { probeOrderEndpoints, type TwistEnv } from "@/lib/twist";

/**
 * Admin route: discover whether the Twist API exposes order data.
 *
 * Read-only. Must run on Render -- Twist whitelists Render's IPs, so calling
 * this from a local machine returns 401/403 regardless of the path.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env: TwistEnv =
    request.nextUrl.searchParams.get("env") === "production"
      ? "production"
      : "staging";
  const email = request.nextUrl.searchParams.get("email") || undefined;

  try {
    return NextResponse.json(await probeOrderEndpoints(env, email));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        env,
        stagingTokensSet:
          !!process.env.TWIST_AUTH_TOKEN && !!process.env.TWIST_END_USER_TOKEN,
        productionTokensSet:
          !!process.env.TWIST_PROD_AUTH_TOKEN &&
          !!process.env.TWIST_PROD_END_USER_TOKEN,
      },
      { status: 500 }
    );
  }
}
