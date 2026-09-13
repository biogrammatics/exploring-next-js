import { describe, it, expect, vi, beforeEach } from "vitest";

// The real getSessionAndUser from @auth/prisma-adapter; captured via
// vi.hoisted so the vi.mock factory (hoisted above imports) can use it.
const { baseGetSessionAndUser } = vi.hoisted(() => ({
  baseGetSessionAndUser: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({
    getSessionAndUser: baseGetSessionAndUser,
  })),
}));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: { deleteMany: vi.fn(), create: vi.fn() },
    authorizedEmail: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { adapter, sessionCallback } from "./auth";
import { SESSION_AUTH_VERSION } from "./session-version";

const ownerUser = {
  id: "owner_1",
  email: "owner@example.com",
  emailVerified: null,
  role: "ADMIN",
};

function runSessionCallback(user: Record<string, unknown>) {
  const session = {
    user: { id: "", email: "owner@example.com", role: "USER", isTeamLogin: false },
    expires: "2999-01-01T00:00:00.000Z",
  };
  return sessionCallback({ session, user } as never) as typeof session;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const v = SESSION_AUTH_VERSION;

describe("adapter.getSessionAndUser", () => {
  it("copies Session.isTeamLogin onto the user when the team membership is still ACTIVE", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date(), isTeamLogin: true, teamEmail: "c@x", authVersion: v },
      user: ownerUser,
    });
    prismaMock.authorizedEmail.findFirst.mockResolvedValue({ id: "ae_1" });
    const result = await adapter.getSessionAndUser!("t");
    expect(baseGetSessionAndUser).toHaveBeenCalledWith("t");
    expect(prismaMock.authorizedEmail.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "c@x", userId: "owner_1", status: "ACTIVE" } })
    );
    expect(result?.user).toMatchObject({ id: "owner_1", isTeamLogin: true });
  });

  it("invalidates a team session whose membership has been revoked", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date(), isTeamLogin: true, teamEmail: "c@x", authVersion: v },
      user: ownerUser,
    });
    prismaMock.authorizedEmail.findFirst.mockResolvedValue(null);
    expect(await adapter.getSessionAndUser!("t")).toBeNull();
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { sessionToken: "t" } });
  });

  it("returns a normal owner session with isTeamLogin false and no membership query", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date(), authVersion: v },
      user: ownerUser,
    });
    const result = await adapter.getSessionAndUser!("t");
    expect(result?.user).toMatchObject({ isTeamLogin: false });
    expect(prismaMock.authorizedEmail.findFirst).not.toHaveBeenCalled();
  });

  it("invalidates a session minted before versioning (authVersion null) instead of trusting it as the owner", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "old", userId: "owner_1", expires: new Date(), isTeamLogin: false, authVersion: null },
      user: ownerUser,
    });
    expect(await adapter.getSessionAndUser!("old")).toBeNull();
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { sessionToken: "old" } });
  });

  it("invalidates a session from a different version", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date(), authVersion: v + 1 },
      user: ownerUser,
    });
    expect(await adapter.getSessionAndUser!("t")).toBeNull();
  });

  it("passes through a missing session as null", async () => {
    baseGetSessionAndUser.mockResolvedValue(null);
    expect(await adapter.getSessionAndUser!("nope")).toBeNull();
  });
});

describe("adapter.createSession", () => {
  it("stamps the current auth version on sessions minted by NextAuth", async () => {
    prismaMock.session.create.mockImplementation(async (args: { data: unknown }) => args.data);
    const expires = new Date();
    const row = await adapter.createSession!({ sessionToken: "n", userId: "u", expires });
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: { sessionToken: "n", userId: "u", expires, authVersion: v },
    });
    expect(row).toMatchObject({ authVersion: v });
  });
});

describe("session callback", () => {
  it("gives an owner session the owner's real role", () => {
    const out = runSessionCallback({ ...ownerUser, isTeamLogin: false });
    expect(out.user).toMatchObject({
      id: "owner_1",
      role: "ADMIN",
      isTeamLogin: false,
    });
  });

  it("never lets a team login inherit the owner's elevated role", () => {
    const out = runSessionCallback({ ...ownerUser, isTeamLogin: true });
    expect(out.user).toMatchObject({
      id: "owner_1",
      role: "USER",
      isTeamLogin: true,
    });
  });

  it.each(["SUPER_ADMIN", "ADMIN", "USER"])(
    "downgrades a team login from %s to USER",
    (role) => {
      const out = runSessionCallback({ ...ownerUser, role, isTeamLogin: true });
      expect(out.user.role).toBe("USER");
    }
  );
});
