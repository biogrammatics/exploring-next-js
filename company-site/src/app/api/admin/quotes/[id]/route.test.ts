import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    serviceQuote: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adminSession,
  superAdminSession,
  userSession,
  teamLoginSession,
} from "@/test/session-fixtures";

const params = { params: Promise.resolve({ id: "q1" }) };

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/quotes/q1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof PATCH>[0];
}

function getRequest() {
  return new Request("http://localhost/api/admin/quotes/q1") as unknown as Parameters<
    typeof GET
  >[0];
}

/** The args handed to the last updateMany call. */
function lastUpdate() {
  const calls = vi.mocked(prisma.serviceQuote.updateMany).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.serviceQuote.findUnique).mockResolvedValue({
    id: "q1",
    status: "PENDING",
    contactedAt: null,
    quotedAt: null,
  } as never);
  vi.mocked(prisma.serviceQuote.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.serviceQuote.deleteMany).mockResolvedValue({ count: 1 } as never);
});

describe("admin quotes route — authorization", () => {
  it("rejects anonymous callers with 401", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(getRequest(), params)).status).toBe(401);
  });

  it("rejects a plain USER with 403", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    expect((await GET(getRequest(), params)).status).toBe(403);
  });

  it("rejects a team login even when the owning account is an admin", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    expect((await GET(getRequest(), params)).status).toBe(403);
  });

  it("allows ADMIN and SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    expect((await GET(getRequest(), params)).status).toBe(200);
    vi.mocked(auth).mockResolvedValue(superAdminSession as never);
    expect((await GET(getRequest(), params)).status).toBe(200);
  });

  it("guards DELETE too, without touching the database", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await DELETE(getRequest(), params);
    expect(res.status).toBe(403);
    expect(prisma.serviceQuote.deleteMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/quotes/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
  });

  it("404s an unknown quote", async () => {
    vi.mocked(prisma.serviceQuote.findUnique).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ status: "CONTACTED", expectedStatus: "PENDING" }), params);
    expect(res.status).toBe(404);
  });

  it("rejects a body with neither a status nor a note", async () => {
    const res = await PATCH(patchRequest({}), params);
    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid status value", async () => {
    const res = await PATCH(
      patchRequest({ status: "BANANA", expectedStatus: "PENDING" }),
      params
    );
    expect(res.status).toBe(400);
  });

  it("requires a status change to declare what it is replacing", async () => {
    const res = await PATCH(patchRequest({ status: "CONTACTED" }), params);
    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.updateMany).not.toHaveBeenCalled();
  });

  it("guards a status change on the status the screen was showing", async () => {
    await PATCH(
      patchRequest({ status: "CONTACTED", expectedStatus: "PENDING" }),
      params
    );
    expect(lastUpdate().where).toEqual({ id: "q1", status: "PENDING" });
  });

  it("409s when the quote moved under the editor", async () => {
    vi.mocked(prisma.serviceQuote.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await PATCH(
      patchRequest({ status: "CONTACTED", expectedStatus: "PENDING" }),
      params
    );
    expect(res.status).toBe(409);
  });

  it("allows any transition, including reviving a declined quote", async () => {
    vi.mocked(prisma.serviceQuote.findUnique).mockResolvedValue({
      id: "q1",
      status: "DECLINED",
      contactedAt: new Date("2026-01-01"),
      quotedAt: null,
    } as never);

    const res = await PATCH(
      patchRequest({ status: "PENDING", expectedStatus: "DECLINED" }),
      params
    );
    expect(res.status).toBe(200);
  });

  it("stamps contactedAt the first time the quote reaches CONTACTED", async () => {
    await PATCH(
      patchRequest({ status: "CONTACTED", expectedStatus: "PENDING" }),
      params
    );
    expect(lastUpdate().data).toMatchObject({ status: "CONTACTED" });
    expect(lastUpdate().data.contactedAt).toBeInstanceOf(Date);
  });

  it("does not rewrite contactedAt on a later pass through CONTACTED", async () => {
    const firstContact = new Date("2026-01-01T00:00:00.000Z");
    vi.mocked(prisma.serviceQuote.findUnique).mockResolvedValue({
      id: "q1",
      status: "QUOTED",
      contactedAt: firstContact,
      quotedAt: new Date(),
    } as never);

    await PATCH(
      patchRequest({ status: "CONTACTED", expectedStatus: "QUOTED" }),
      params
    );
    expect(lastUpdate().data.contactedAt).toBeUndefined();
  });

  it("saves a note without guarding on status, so a colleague's change does not block it", async () => {
    await PATCH(patchRequest({ adminNotes: "Quoted 3 leaders" }), params);
    expect(lastUpdate().where).toEqual({ id: "q1" });
    expect(lastUpdate().data).toEqual({ adminNotes: "Quoted 3 leaders" });
  });

  it("stores a blank note as null rather than an empty string", async () => {
    await PATCH(patchRequest({ adminNotes: "   " }), params);
    expect(lastUpdate().data).toEqual({ adminNotes: null });
  });

  it("rejects an over-long note", async () => {
    const res = await PATCH(
      patchRequest({ adminNotes: "x".repeat(9000) }),
      params
    );
    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a body that is not valid JSON", async () => {
    const req = new Request("http://localhost/api/admin/quotes/q1", {
      method: "PATCH",
      body: "{nope",
      headers: { "content-type": "application/json" },
    }) as unknown as Parameters<typeof PATCH>[0];
    expect((await PATCH(req, params)).status).toBe(400);
  });
});

describe("DELETE /api/admin/quotes/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
  });

  it("deletes the quote", async () => {
    const res = await DELETE(getRequest(), params);
    expect(res.status).toBe(200);
    expect(prisma.serviceQuote.deleteMany).toHaveBeenCalledWith({
      where: { id: "q1" },
    });
  });

  it("404s when the quote is already gone", async () => {
    vi.mocked(prisma.serviceQuote.deleteMany).mockResolvedValue({ count: 0 } as never);
    expect((await DELETE(getRequest(), params)).status).toBe(404);
  });
});
