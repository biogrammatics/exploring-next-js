import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    serviceQuote: { create: vi.fn() },
  },
}));
vi.mock("@/lib/quote-notification", () => ({
  sendQuoteNotifications: vi.fn(),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendQuoteNotifications } from "@/lib/quote-notification";
import { makeSession, userSession, teamLoginSession } from "@/test/session-fixtures";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/path-to-protein", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as Parameters<typeof POST>[0];
}

/** Minimal valid design; individual tests override the contact block. */
function design(contact: Record<string, unknown> = {}) {
  return {
    proteinName: "Test protein",
    proteinSequence: "MGSSHHHHHHSSGLVPRGSHMASMTGGQQMGRGSEF",
    tags: [{ tagId: "his6", position: "c" }],
    format: { mode: "secreted", leaders: ["s1", "s3", "s5"] },
    vector: { arm: "no", promoter: "aox1", integration: "random", marker: "Zeocin" },
    strain: { protease: "no", glyco: "standard", silac: false },
    deliverable: "sse_gel",
    screeningVariables: [],
    contact,
  };
}

/** The data object handed to prisma.serviceQuote.create on the last call. */
function createdQuote() {
  return vi.mocked(prisma.serviceQuote.create).mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.serviceQuote.create).mockResolvedValue({
    id: "quote_1",
    quoteNumber: "qn_1",
    createdAt: new Date(),
  } as never);
  vi.mocked(sendQuoteNotifications).mockResolvedValue({
    teamNotified: true,
    customerAcknowledged: true,
  });
});

describe("POST /api/path-to-protein — contact resolution", () => {
  it("rejects a guest who supplies no email, without creating a quote", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(postRequest(design()));

    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.create).not.toHaveBeenCalled();
  });

  it("accepts a guest who supplies an email and stores it normalized", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(postRequest(design({ email: "  Guest@Lab.ORG " })));

    expect(res.status).toBe(200);
    expect(createdQuote().emailAddress).toBe("guest@lab.org");
  });

  it("leaves userId null for a guest, so an unverified address cannot attach to an account", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await POST(postRequest(design({ email: "someone@example.com" })));

    expect(createdQuote().userId).toBeNull();
  });

  it("falls back to the account address for a signed-in customer", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await POST(postRequest(design()));

    expect(res.status).toBe(200);
    expect(createdQuote().emailAddress).toBe("user@example.com");
    expect(createdQuote().userId).toBe("user_1");
  });

  it("prefers an explicitly supplied address over the account address", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(postRequest(design({ email: "Elsewhere@Example.com" })));

    expect(createdQuote().emailAddress).toBe("elsewhere@example.com");
    // Still linked to the signed-in account.
    expect(createdQuote().userId).toBe("user_1");
  });

  it("normalizes a signed-in address whose session casing differs", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("USER", { email: "Mixed.Case@Example.COM" }) as never
    );
    await POST(postRequest(design()));

    expect(createdQuote().emailAddress).toBe("mixed.case@example.com");
  });

  it("refuses to assume the owner's address on a team login", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    const res = await POST(postRequest(design()));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("shared team login"),
    });
    expect(prisma.serviceQuote.create).not.toHaveBeenCalled();
  });

  it("accepts a team login that supplies the colleague's own address", async () => {
    vi.mocked(auth).mockResolvedValue(teamLoginSession as never);
    const res = await POST(postRequest(design({ email: "colleague@example.com" })));

    expect(res.status).toBe(200);
    expect(createdQuote().emailAddress).toBe("colleague@example.com");
  });

  it("rejects a malformed address", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(postRequest(design({ email: "not-an-address" })));

    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.create).not.toHaveBeenCalled();
  });

  it("strips control characters from contact fields", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await POST(
      postRequest(
        design({
          email: "guest@example.com",
          fullName: "Ada\u0000 Lovelace\u001F",
          organization: "  Analytical Engines  ",
        })
      )
    );

    expect(createdQuote().fullName).toBe("Ada Lovelace");
    expect(createdQuote().organization).toBe("Analytical Engines");
  });
});

describe("POST /api/path-to-protein — sequence gate", () => {
  it("rejects a sequence containing non-standard residues", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await POST(
      postRequest({ ...design(), proteinSequence: "MGSXXZJUO" })
    );

    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.create).not.toHaveBeenCalled();
  });

  it("rejects an oversized sequence before touching the database", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const res = await POST(
      postRequest({ ...design(), proteinSequence: "M".repeat(10_000) })
    );

    expect(res.status).toBe(400);
    expect(prisma.serviceQuote.create).not.toHaveBeenCalled();
  });

  it("stores the cleaned sequence, not the raw paste", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(
      postRequest({
        ...design(),
        proteinSequence: ">sp|TEST| my protein\nMGSS HHHH\nHHSS GLVP",
      })
    );

    const stored = createdQuote().selectedServices as {
      design: { proteinSequence: string };
    };
    expect(stored.design.proteinSequence).toBe("MGSSHHHHHHSSGLVP");
  });
});

describe("POST /api/path-to-protein — quote record", () => {
  it("never stores a price", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(postRequest(design()));

    expect(createdQuote().estimatedTotal).toBeNull();
  });

  it("opens the quote in PENDING for the team to triage", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(postRequest(design()));

    expect(createdQuote().status).toBe("PENDING");
  });

  it("records a readable design summary alongside the machine-readable design", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(postRequest(design()));

    const summary = createdQuote().specialRequirements as string;
    expect(summary).toContain("Leaders requested: s1, s3, s5");
    expect(summary).toContain("Matching vectors");
  });

  it("keeps the customer's own notes separate from the generated summary", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    await POST(
      postRequest(design({ notes: "Needs an NDA before we share the sequence." }))
    );

    expect(createdQuote().notes).toBe("Needs an NDA before we share the sequence.");
    expect(createdQuote().specialRequirements).not.toContain("NDA");
  });

  it("notifies the team with the resolved contact address and a summary", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await POST(postRequest(design({ email: "Guest@Lab.ORG", fullName: "Ada" })));

    expect(sendQuoteNotifications).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendQuoteNotifications).mock.calls[0][0]).toMatchObject({
      quoteNumber: "qn_1",
      contactEmail: "guest@lab.org",
      fullName: "Ada",
    });
  });

  it("still succeeds when notification reports the team was not reached", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    vi.mocked(sendQuoteNotifications).mockResolvedValue({
      teamNotified: false,
      customerAcknowledged: false,
    });

    const res = await POST(postRequest(design()));

    // The design is saved; a mail outage must not look like a failed submission.
    expect(res.status).toBe(200);
    expect(prisma.serviceQuote.create).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when notification throws despite its contract", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    vi.mocked(sendQuoteNotifications).mockRejectedValue(new Error("resend down"));

    const res = await POST(postRequest(design()));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ quoteNumber: "qn_1" });
  });

  it("does not send anything when the submission is rejected", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await POST(postRequest(design()));

    expect(sendQuoteNotifications).not.toHaveBeenCalled();
  });

  it("rejects a body that is not valid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(userSession as never);
    const req = new Request("http://localhost/api/path-to-protein", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    }) as unknown as Parameters<typeof POST>[0];

    expect((await POST(req)).status).toBe(400);
  });
});
