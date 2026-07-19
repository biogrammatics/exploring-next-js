import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findMany: vi.fn() } },
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adminSession,
  superAdminSession,
  userSession,
} from "@/test/session-fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
});

describe("GET /api/admin/users authorization", () => {
  it("rejects anonymous callers with 403", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("allows ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
