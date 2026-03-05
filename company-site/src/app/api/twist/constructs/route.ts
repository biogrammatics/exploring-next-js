import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createConstruct } from "@/lib/twist";
import { createConstructSchema, formatZodError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (
    session?.user?.role !== "ADMIN" &&
    session?.user?.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
