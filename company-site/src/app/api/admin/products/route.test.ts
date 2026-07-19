import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { GET, POST } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminSession, userSession } from "@/test/session-fixtures";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.product.create).mockResolvedValue({ id: "p1" } as never);
});

describe("GET /api/admin/products authorization", () => {
  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    expect((await GET()).status).toBe(403);
  });
  it("allows ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    expect((await GET()).status).toBe(200);
  });
});

describe("POST /api/admin/products", () => {
  const validProduct = { name: "Competent cells", price: 5000 };

  it("rejects anonymous callers before touching the database", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(postRequest(validProduct));
    expect(res.status).toBe(403);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await POST(postRequest(validProduct));
    expect(res.status).toBe(403);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid body from an ADMIN with 400 (no create)", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await POST(postRequest({ name: "" }));
    expect(res.status).toBe(400);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });
});
