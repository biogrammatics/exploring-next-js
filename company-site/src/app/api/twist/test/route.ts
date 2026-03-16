import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testConnection } from "@/lib/twist";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await testConnection();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: 500,
        data: { error: error instanceof Error ? error.message : "Unknown error" },
        config: {
          email: process.env.TWIST_API_EMAIL || "(not set)",
          baseUrl: process.env.TWIST_API_BASE_URL || "(not set)",
          emailSource: process.env.TWIST_API_EMAIL ? "env" : "fallback",
          authTokenSet: !!process.env.TWIST_AUTH_TOKEN,
          endUserTokenSet: !!process.env.TWIST_END_USER_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
