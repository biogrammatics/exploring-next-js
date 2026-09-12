import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { orderLineInclude } from "@/lib/order-lines";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      ...orderLineInclude,
    },
  });

  return NextResponse.json(orders);
}
