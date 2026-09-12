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
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { adapter, sessionCallback } from "./auth";

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

describe("adapter.getSessionAndUser", () => {
  it("copies Session.isTeamLogin onto the user so the session callback sees it", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date(), isTeamLogin: true },
      user: ownerUser,
    });
    const result = await adapter.getSessionAndUser!("t");
    expect(baseGetSessionAndUser).toHaveBeenCalledWith("t");
    expect(result?.user).toMatchObject({ id: "owner_1", isTeamLogin: true });
  });

  it("defaults isTeamLogin to false for a normal session row", async () => {
    baseGetSessionAndUser.mockResolvedValue({
      session: { sessionToken: "t", userId: "owner_1", expires: new Date() },
      user: ownerUser,
    });
    const result = await adapter.getSessionAndUser!("t");
    expect(result?.user).toMatchObject({ isTeamLogin: false });
  });

  it("passes through a missing session as null", async () => {
    baseGetSessionAndUser.mockResolvedValue(null);
    expect(await adapter.getSessionAndUser!("nope")).toBeNull();
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
