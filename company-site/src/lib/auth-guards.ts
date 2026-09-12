import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma/client";

/**
 * Single source of truth for "who counts as an admin".
 *
 * Every admin API route, admin page, and admin Server Action must go through
 * one of the helpers below instead of hand-rolling a role comparison. The
 * hand-rolled copies drifted (some accepted only "ADMIN", some returned 401
 * and some 403 for the same condition); this module fixes one answer.
 */
export const ADMIN_ROLES: readonly Role[] = ["ADMIN", "SUPER_ADMIN"];

export function isAdminRole(role: Role | string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function isSuperAdminRole(role: Role | string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

type GuardOk = { session: Session; response?: undefined };
type GuardFail = { session?: undefined; response: NextResponse };
export type GuardResult = GuardOk | GuardFail;

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * API-route guard: any signed-in user.
 *
 *   const guard = await requireUser();
 *   if (guard.response) return guard.response;
 *   const { session } = guard;
 */
export async function requireUser(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) return { response: unauthorized() };
  return { session };
}

/**
 * API-route guard: ADMIN or SUPER_ADMIN. Team-login sessions (a colleague
 * signed in through an owner's authorized email) never count as admin, even
 * if the owning account is an admin.
 */
export async function requireAdmin(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) return { response: unauthorized() };
  if (session.user.isTeamLogin || !isAdminRole(session.user.role)) {
    return { response: forbidden() };
  }
  return { session };
}

/** API-route guard: SUPER_ADMIN only. */
export async function requireSuperAdmin(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) return { response: unauthorized() };
  if (session.user.isTeamLogin || !isSuperAdminRole(session.user.role)) {
    return { response: forbidden() };
  }
  return { session };
}

/**
 * Server Action guard. Server Actions execute before any layout renders, so
 * the admin layout's redirect does NOT protect them; every action must call
 * this itself. Throws so the action aborts before touching the database.
 */
export async function assertAdminAction(): Promise<Session> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.isTeamLogin ||
    !isAdminRole(session.user.role)
  ) {
    throw new Error("Unauthorized: admin role required");
  }
  return session;
}

export async function assertSuperAdminAction(): Promise<Session> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.isTeamLogin ||
    !isSuperAdminRole(session.user.role)
  ) {
    throw new Error("Unauthorized: super admin role required");
  }
  return session;
}

/** Server Component (page/layout) guard: redirects non-admins home. */
export async function requireAdminPage(): Promise<Session> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.isTeamLogin ||
    !isAdminRole(session.user.role)
  ) {
    redirect("/");
  }
  return session;
}

/** Server Component guard: redirects anonymous visitors to sign-in. */
export async function requireUserPage(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  return session;
}
