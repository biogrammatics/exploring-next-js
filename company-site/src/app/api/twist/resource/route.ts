import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserResource } from "@/lib/twist";

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

  const path = request.nextUrl.searchParams.get("path") ?? "orders/";
  const query = request.nextUrl.searchParams.get("query") ?? "";

  try {
    return NextResponse.json(await getUserResource(path, query));
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
