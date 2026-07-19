import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { GET, PUT } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { makeSession } from "@/test/session-fixtures";

function putRequest(body: unknown) {
  return new Request("http://localhost/api/account/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof PUT>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "u@x.com" } as never);
  vi.mocked(prisma.user.update).mockResolvedValue({ id: "user_42" } as never);
});

describe("GET /api/account/profile", () => {
  it("requires authentication (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("reads only the caller's own record (no IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("USER", { id: "user_42" }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_42" } })
    );
  });
});

describe("PUT /api/account/profile", () => {
  it("requires authentication (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PUT(putRequest({ name: "New Name" }));
    expect(res.status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates only the caller's own record", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("USER", { id: "user_42" }) as never);
    const res = await PUT(putRequest({ name: "New Name" }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_42" } })
    );
  });

  it("rejects an invalid body (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("USER", { id: "user_42" }) as never);
    // name must be a string; a number should fail schema validation.
    const res = await PUT(putRequest({ name: 12345 }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
