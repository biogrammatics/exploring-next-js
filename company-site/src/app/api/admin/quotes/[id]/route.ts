import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatZodError, updateQuoteSchema } from "@/lib/validations";
import { QUOTE_STATUS_TIMESTAMP } from "@/lib/quote-status";
import type { Prisma } from "@/generated/prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;
  const quote = await prisma.serviceQuote.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(quote);
}

/**
 * Update a quote's status and/or the team's internal notes.
 *
 * Any status transition is permitted — a quote status is an internal sales
 * label, not a money-derived state (see quote-status.ts). What is guarded is
 * concurrency: the write is conditional on the status the admin's screen was
 * showing, so two people working the same queue cannot clobber each other.
 */
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

  const parsed = updateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const { status, expectedStatus, adminNotes } = parsed.data;

  const current = await prisma.serviceQuote.findUnique({
    where: { id },
    select: { id: true, status: true, contactedAt: true, quotedAt: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const data: Prisma.ServiceQuoteUpdateManyMutationInput = {};

  if (adminNotes !== undefined) {
    data.adminNotes = adminNotes && adminNotes.trim() ? adminNotes.trim() : null;
  }

  if (status !== undefined) {
    data.status = status;

    // Stamp the first time this quote reaches a milestone, and never rewrite
    // it: "contactedAt" means when we first made contact, so moving the status
    // back and forward must not move the date.
    const field = QUOTE_STATUS_TIMESTAMP[status];
    if (field && current[field] === null) {
      data[field] = new Date();
    }
  }

  // Conditional write. Only guard on status when the request is changing it —
  // a note should still save if a colleague advanced the status meanwhile.
  const where =
    status !== undefined ? { id, status: expectedStatus } : { id };

  const { count } = await prisma.serviceQuote.updateMany({ where, data });
  if (count === 0) {
    return NextResponse.json(
      {
        error:
          "This quote changed while you were editing it. Reload and try again.",
      },
      { status: 409 }
    );
  }

  const quote = await prisma.serviceQuote.findUnique({ where: { id } });
  return NextResponse.json(quote);
}

/**
 * Permanently delete a quote.
 *
 * There is no soft-delete column on this model, so this is irreversible and
 * the customer's submitted design goes with it. The UI requires the quote
 * number to be typed before it will call this. Intended for test and spam
 * rows; a genuine enquiry that came to nothing belongs in DECLINED, where it
 * stays on the record.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  const { id } = await params;

  const { count } = await prisma.serviceQuote.deleteMany({ where: { id } });
  if (count === 0) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  console.warn(
    `[quote ${id}] permanently deleted by ${guard.session?.user?.email ?? "unknown admin"}`
  );

  return NextResponse.json({ success: true });
}
