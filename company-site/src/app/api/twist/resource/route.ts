import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserResource, type TwistEnv } from "@/lib/twist";

/**
 * Admin route: GET an arbitrary resource under /v1/users/{email}/.
 *
 * Used by the Past Orders section of the twist-test page. Order endpoints are
 * undocumented, so the path is supplied by the caller and validated in the
 * library rather than fixed here.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const path = params.get("path") ?? "orders/";
  const query = params.get("query") ?? "";
  const env: TwistEnv =
    params.get("env") === "production" ? "production" : "staging";
  const email = params.get("email") || undefined;

  try {
    return NextResponse.json(await getUserResource(path, query, env, email));
  } catch (error) {
    return NextResponse.json(
      {
        status: 500,
        data: { error: error instanceof Error ? error.message : "Unknown error" },
      },
      { status: 500 }
    );
  }
}
