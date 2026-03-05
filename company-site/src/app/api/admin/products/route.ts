import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createProductSchema, formatZodError } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (
    !session?.user ||
    !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const raw = await request.json();
  const parsed = createProductSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }

  const product = await prisma.product.create({
    data: parsed.data,
  });

  return NextResponse.json(product, { status: 201 });
}
