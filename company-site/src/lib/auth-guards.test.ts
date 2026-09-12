import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  assertAdminAction,
  assertSuperAdminAction,
  isAdminRole,
  requireAdmin,
  requireAdminPage,
  requireSuperAdmin,
  requireUser,
} from "./auth-guards";
import {
  adminSession,
  superAdminSession,
  teamLoginSession,
  userSession,
} from "@/test/session-fixtures";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAdminRole", () => {
  it("accepts ADMIN and SUPER_ADMIN only", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminRole("USER")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("requireUser", () => {
  it("returns 401 for anonymous callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const guard = await requireUser();
    expect(guard.response?.status).toBe(401);
    expect(guard.session).toBeUndefined();
  });

  it("returns the session for any signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const guard = await requireUser();
    expect(guard.response).toBeUndefined();
    expect(guard.session).toBe(userSession);
  });
});

describe("requireAdmin", () => {
  it("returns 401 for anonymous callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const guard = await requireAdmin();
    expect(guard.response?.status).toBe(401);
    await expect(guard.response!.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("returns 403 for a plain USER", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const guard = await requireAdmin();
    expect(guard.response?.status).toBe(403);
    await expect(guard.response!.json()).resolves.toEqual({
      error: "Forbidden",
    });
  });

  it("returns 403 for a team-login session even when the owner is ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    const guard = await requireAdmin();
    expect(guard.response?.status).toBe(403);
  });

  it("passes an ADMIN through with the session", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const guard = await requireAdmin();
    expect(guard.response).toBeUndefined();
    expect(guard.session).toBe(adminSession);
  });

  it("passes a SUPER_ADMIN through with the session", async () => {
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    const guard = await requireAdmin();
    expect(guard.response).toBeUndefined();
    expect(guard.session).toBe(superAdminSession);
  });
});

describe("requireSuperAdmin", () => {
  it("returns 401 for anonymous callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await requireSuperAdmin()).response?.status).toBe(401);
  });

  it("returns 403 for a plain USER", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    expect((await requireSuperAdmin()).response?.status).toBe(403);
  });

  it("returns 403 for an ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    expect((await requireSuperAdmin()).response?.status).toBe(403);
  });

  it("returns 403 for a team-login session", async () => {
    vi.mocked(auth).mockResolvedValue(
      { ...superAdminSession, user: { ...superAdminSession.user, isTeamLogin: true } } as never
    );
    expect((await requireSuperAdmin()).response?.status).toBe(403);
  });

  it("passes a SUPER_ADMIN through", async () => {
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    const guard = await requireSuperAdmin();
    expect(guard.response).toBeUndefined();
    expect(guard.session).toBe(superAdminSession);
  });
});

describe("assertAdminAction / assertSuperAdminAction", () => {
  it("throws for anonymous, USER and team-login sessions", async () => {
    for (const s of [null, userSession, teamLoginSession]) {
      vi.mocked(auth).mockResolvedValue(s as never);
      await expect(assertAdminAction()).rejects.toThrow(/admin role required/);
    }
  });

  it("returns the session for ADMIN and SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    await expect(assertAdminAction()).resolves.toBe(adminSession);
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    await expect(assertAdminAction()).resolves.toBe(superAdminSession);
  });

  it("assertSuperAdminAction rejects ADMIN but accepts SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    await expect(assertSuperAdminAction()).rejects.toThrow(/super admin/);
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    await expect(assertSuperAdminAction()).resolves.toBe(superAdminSession);
  });
});

describe("requireAdminPage", () => {
  it("redirects non-admins home", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("redirects team-login sessions home", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("returns the session for an admin", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    await expect(requireAdminPage()).resolves.toBe(adminSession);
    expect(redirect).not.toHaveBeenCalled();
  });
});
