import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { createConstruct } from "@/lib/twist";
import { createConstructSchema, formatZodError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const raw = await request.json();
    const parsed = createConstructSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const result = await createConstruct(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Twist construct creation error:", error);
    return NextResponse.json(
      { error: "Failed to create construct" },
      { status: 500 }
    );
  }
}
