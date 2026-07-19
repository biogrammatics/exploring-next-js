import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { vectorLotFile: { findMany: vi.fn() } },
}));
vi.mock("@/lib/s3", () => ({ uploadToS3: vi.fn(), BUCKET_NAME: "test-bucket" }));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminSession, userSession } from "@/test/session-fixtures";

function call() {
  const req = new Request(
    "http://localhost/api/admin/vectors/v1/lots/l1/files"
  ) as unknown as Parameters<typeof GET>[0];
  return GET(req, { params: Promise.resolve({ id: "v1", lotId: "l1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.vectorLotFile.findMany).mockResolvedValue([] as never);
});

describe("GET lot QC files authorization (#8)", () => {
  it("rejects anonymous callers", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
    expect(prisma.vectorLotFile.findMany).not.toHaveBeenCalled();
  });

  it("rejects a plain USER (metadata is admin-only)", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    expect((await call()).status).toBe(401);
    expect(prisma.vectorLotFile.findMany).not.toHaveBeenCalled();
  });

  it("allows an ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    expect((await call()).status).toBe(200);
    expect(prisma.vectorLotFile.findMany).toHaveBeenCalled();
  });
});
