import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { orderLineInclude } from "@/lib/order-lines";
import { canAdminTransition } from "@/lib/order-status";
import { formatZodError, updateOrderStatusSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      ...orderLineInclude,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const next = parsed.data.status;

  const current = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Admins may only move an order along the fulfilment path or cancel it;
  // payment-derived states belong to the Stripe webhook.
  if (!canAdminTransition(current.status, next)) {
    return NextResponse.json(
      { error: `Cannot change status from ${current.status} to ${next}` },
      { status: 400 }
    );
  }

  // Conditional write: the transition was validated against `current.status`,
  // so only apply it if the row is still in that state. Otherwise a webhook
  // (refund, dispute) that landed between our read and write would be
  // silently overwritten by a stale admin request.
  const { count } = await prisma.order.updateMany({
    where: { id, status: current.status },
    data: { status: next },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: "Order changed while you were editing. Reload and try again." },
      { status: 409 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id } });
  return NextResponse.json(order);
}
