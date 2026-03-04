import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { describeConstruct } from "@/lib/twist";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const constructId = request.nextUrl.searchParams.get("id");
  if (!constructId) {
    return NextResponse.json(
      { error: "Construct ID is required (?id=...)" },
      { status: 400 }
    );
  }

  try {
    const result = await describeConstruct(constructId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
