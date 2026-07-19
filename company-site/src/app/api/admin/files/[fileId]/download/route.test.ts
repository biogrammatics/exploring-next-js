import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    vectorFile: { findUnique: vi.fn() },
    vectorLotFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/s3", () => ({
  getSignedDownloadUrl: vi.fn(async () => "https://s3.example/signed-url"),
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminSession, userSession } from "@/test/session-fixtures";

function call(fileId: string) {
  const req = new Request(
    `http://localhost/api/admin/files/${fileId}/download`
  ) as unknown as Parameters<typeof GET>[0];
  return GET(req, { params: Promise.resolve({ fileId }) });
}

function vectorFile(isAvailable: boolean) {
  return {
    s3Key: "k",
    fileName: "map.gb",
    vector: { productStatus: { isAvailable } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.vectorFile.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.vectorLotFile.findUnique).mockResolvedValue(null as never);
});

describe("vector file downloads", () => {
  it("is public for an AVAILABLE product (no session required)", async () => {
    vi.mocked(prisma.vectorFile.findUnique).mockResolvedValue(vectorFile(true) as never);
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await call("vf1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://s3.example/signed-url");
  });

  it("requires a session for an UNAVAILABLE product", async () => {
    vi.mocked(prisma.vectorFile.findUnique).mockResolvedValue(vectorFile(false) as never);
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await call("vf1");
    expect(res.status).toBe(401);
  });

  // FINDING #8 (fixed): an UNAVAILABLE product's files require admin, not just
  // any authenticated user.
  it("forbids a plain USER from an UNAVAILABLE product file (#8)", async () => {
    vi.mocked(prisma.vectorFile.findUnique).mockResolvedValue(vectorFile(false) as never);
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await call("vf1");
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN to download an UNAVAILABLE product file", async () => {
    vi.mocked(prisma.vectorFile.findUnique).mockResolvedValue(vectorFile(false) as never);
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await call("vf1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://s3.example/signed-url");
  });
});

describe("lot QC file downloads (admin-only)", () => {
  beforeEach(() => {
    vi.mocked(prisma.vectorLotFile.findUnique).mockResolvedValue({
      s3Key: "k",
      fileName: "qc.pdf",
    } as never);
  });

  it("rejects a plain USER with 401", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await call("lot1");
    expect(res.status).toBe(401);
  });

  it("allows an ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await call("lot1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://s3.example/signed-url");
  });

  it("returns 404 for an admin when no file matches", async () => {
    vi.mocked(prisma.vectorLotFile.findUnique).mockResolvedValue(null as never);
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    const res = await call("missing");
    expect(res.status).toBe(404);
  });
});
