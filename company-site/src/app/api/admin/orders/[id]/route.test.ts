import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { order: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));

import { GET, PATCH } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adminSession,
  makeSession,
  superAdminSession,
  userSession,
} from "@/test/session-fixtures";

const ORDER_ID = "order_1";

function patch(body: unknown, raw = false) {
  const req = new Request(`http://localhost/api/admin/orders/${ORDER_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
  return PATCH(req, { params: Promise.resolve({ id: ORDER_ID }) });
}

function get() {
  const req = new Request(
    `http://localhost/api/admin/orders/${ORDER_ID}`
  ) as unknown as Parameters<typeof GET>[0];
  return GET(req, { params: Promise.resolve({ id: ORDER_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.order.findUnique).mockResolvedValue({
    id: ORDER_ID,
    status: "PAID",
    items: [],
    vectorOrderItems: [],
    strainOrderItems: [],
  } as never);
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);
});

describe("PATCH /api/admin/orders/[id] authorization", () => {
  it("rejects anonymous callers with 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(401);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(403);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a team login on an admin account with 403", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("ADMIN", { isTeamLogin: true }) as never
    );
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(403);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("allows ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(200);
  });

  // Previously the route compared role === "ADMIN" only, locking out
  // SUPER_ADMIN.
  it("allows SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(200);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, status: "PAID" },
      data: { status: "SHIPPED" },
    });
  });
});

describe("PATCH /api/admin/orders/[id] validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await patch("{not json", true);
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for a status outside the enum", async () => {
    const res = await patch({ status: "TELEPORTED" });
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when status is missing", async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the order does not exist", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(404);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for a disallowed transition (PAID -> PENDING)", async () => {
    const res = await patch({ status: "PENDING" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Cannot change status from PAID to PENDING",
    });
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to mark an unpaid order as PAID by hand", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: ORDER_ID,
      status: "PENDING",
    } as never);
    const res = await patch({ status: "PAID" });
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to reopen a REFUNDED order", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: ORDER_ID,
      status: "REFUNDED",
    } as never);
    const res = await patch({ status: "PROCESSING" });
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("applies an allowed transition (PAID -> PROCESSING) and returns 200", async () => {
    const res = await patch({ status: "PROCESSING" });
    expect(res.status).toBe(200);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, status: "PAID" },
      data: { status: "PROCESSING" },
    });
  });

  it("returns 409 when the order changed between read and write (e.g. a refund landed)", async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await patch({ status: "SHIPPED" });
    expect(res.status).toBe(409);
  });

  it("refuses to declare a refund by hand on a DISPUTED order", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: ORDER_ID,
      status: "DISPUTED",
    } as never);
    const res = await patch({ status: "REFUNDED" });
    expect(res.status).toBe(400);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("applies SHIPPED -> DELIVERED", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: ORDER_ID,
      status: "SHIPPED",
    } as never);
    const res = await patch({ status: "DELIVERED" });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/admin/orders/[id]", () => {
  it("rejects anonymous callers with 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await get()).status).toBe(401);
  });

  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    expect((await get()).status).toBe(403);
  });

  it("allows SUPER_ADMIN and loads all three line-item tables", async () => {
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    const res = await get();
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.order.findUnique).mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    expect(Object.keys(args.include)).toEqual(
      expect.arrayContaining(["items", "vectorOrderItems", "strainOrderItems"])
    );
  });

  it("returns 404 for a missing order", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null as never);
    expect((await get()).status).toBe(404);
  });
});
