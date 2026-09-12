import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    authorizedEmail: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { POST, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { makeSession } from "@/test/session-fixtures";

// A colleague signed in through the owner's authorized email. The owner is an
// ADMIN; the flag is what must gate the request, not the role.
const teamLoginSession = makeSession("ADMIN", {
  id: "owner_1",
  email: "owner@example.com",
  isTeamLogin: true,
});
const ownerSession = makeSession("USER", {
  id: "owner_1",
  email: "owner@example.com",
  isTeamLogin: false,
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/account/team", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof POST>[0];
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/account/team?id=${id}`, {
    method: "DELETE",
  }) as unknown as Parameters<typeof DELETE>[0];
}

const revokedRow = {
  id: "ae_revoked",
  email: "colleague@example.com",
  userId: "owner_1",
  status: "REVOKED",
  revokedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ id: "email_1" });
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.authorizedEmail.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.authorizedEmail.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.authorizedEmail.create).mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({
      id: "ae_new",
      invitedAt: new Date(),
      ...args.data,
    })) as never
  );
  vi.mocked(prisma.authorizedEmail.update).mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({
      ...revokedRow,
      invitedAt: new Date(),
      ...args.data,
    })) as never
  );
});

describe("POST /api/account/team", () => {
  it("requires authentication (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(postRequest({ email: "x@example.com" }));
    expect(res.status).toBe(401);
  });

  it("refuses a team-login session even when the owner is an admin (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    const res = await POST(postRequest({ email: "x@example.com" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Team members cannot change account settings",
    });
    expect(prisma.authorizedEmail.create).not.toHaveBeenCalled();
    expect(prisma.authorizedEmail.update).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("revives a REVOKED row instead of creating a duplicate", async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession as never);
    vi.mocked(prisma.authorizedEmail.findUnique).mockResolvedValue(
      revokedRow as never
    );

    const res = await POST(postRequest({ email: "Colleague@Example.com " }));
    expect(res.status).toBe(200);

    // Looked up by the (email, userId) unique key, with the address normalized.
    expect(prisma.authorizedEmail.findUnique).toHaveBeenCalledWith({
      where: {
        email_userId: { email: "colleague@example.com", userId: "owner_1" },
      },
    });

    expect(prisma.authorizedEmail.create).not.toHaveBeenCalled();
    expect(prisma.authorizedEmail.update).toHaveBeenCalledTimes(1);
    const updateArg = vi.mocked(prisma.authorizedEmail.update).mock
      .calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArg.where).toEqual({ id: "ae_revoked" });
    expect(updateArg.data).toMatchObject({
      status: "PENDING",
      revokedAt: null,
      confirmedAt: null,
    });
    expect(typeof updateArg.data.inviteToken).toBe("string");
    expect(updateArg.data.inviteTokenExpires).toBeInstanceOf(Date);

    // Fresh invitation goes out to the normalized address.
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "colleague@example.com" })
    );
    expect(await res.json()).toMatchObject({
      success: true,
      teamEmail: { status: "PENDING", email: "colleague@example.com" },
    });
  });

  it("creates a new row when none exists for (email, userId)", async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession as never);
    const res = await POST(postRequest({ email: "new@example.com" }));
    expect(res.status).toBe(200);
    expect(prisma.authorizedEmail.update).not.toHaveBeenCalled();
    expect(prisma.authorizedEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          userId: "owner_1",
          status: "PENDING",
        }),
      })
    );
  });

  it.each(["ACTIVE", "PENDING"])(
    "still rejects a re-invite when the existing row is %s (400)",
    async (status) => {
      vi.mocked(auth).mockResolvedValue(ownerSession as never);
      vi.mocked(prisma.authorizedEmail.findUnique).mockResolvedValue({
        ...revokedRow,
        status,
      } as never);
      const res = await POST(postRequest({ email: "colleague@example.com" }));
      expect(res.status).toBe(400);
      expect(prisma.authorizedEmail.create).not.toHaveBeenCalled();
      expect(prisma.authorizedEmail.update).not.toHaveBeenCalled();
    }
  );
});

describe("DELETE /api/account/team", () => {
  it("requires authentication (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE(deleteRequest("ae_1"));
    expect(res.status).toBe(401);
  });

  it("refuses a team-login session (403)", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    const res = await DELETE(deleteRequest("ae_1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Team members cannot change account settings",
    });
    expect(prisma.authorizedEmail.findFirst).not.toHaveBeenCalled();
    expect(prisma.authorizedEmail.update).not.toHaveBeenCalled();
  });

  it("soft-revokes a row the owner controls", async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession as never);
    vi.mocked(prisma.authorizedEmail.findFirst).mockResolvedValue({
      id: "ae_1",
      userId: "owner_1",
    } as never);
    const res = await DELETE(deleteRequest("ae_1"));
    expect(res.status).toBe(200);
    expect(prisma.authorizedEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ae_1" },
        data: expect.objectContaining({ status: "REVOKED" }),
      })
    );
  });
});
