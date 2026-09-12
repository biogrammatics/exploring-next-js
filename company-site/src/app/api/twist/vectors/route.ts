import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { getVectors } from "@/lib/twist";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const result = await getVectors();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
