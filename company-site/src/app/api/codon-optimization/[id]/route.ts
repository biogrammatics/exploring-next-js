import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/codon-optimization/[id]
 * Get the status and results of a specific job.
 * Access rules:
 *  - Authenticated user: must own the job (job.userId matches session)
 *  - Admin/Super Admin: can view any job
 *  - Guest jobs (no userId): accessible by job ID. The id is a random uuid()
 *    (see prisma/schema.prisma) and is the only credential a guest holds, so
 *    it must stay unguessable and must never be logged or exposed in listings.
 *    This bypass applies ONLY to jobs with no userId: a signed-in user's job
 *    (and its sequences) must never be returned to anyone but the owner or an
 *    admin, even when the caller knows the id.
 *
 * While a job is PENDING/PROCESSING the client polls this endpoint every few
 * seconds and only renders sequences after completion, so `proteinSequence`
 * and `dnaSequence` are omitted from the payload until status is COMPLETED.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();

    const job = await prisma.codonOptimizationJob.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        proteinSequence: true,
        proteinName: true,
        targetOrganism: true,
        dnaSequence: true,
        errorMessage: true,
        twistScore: true,
        twistDifficulty: true,
        twistErrors: true,
        vectorName: true,
        goldenGateExclusion: true,
        excludedEnzymeNames: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Authorization: if job has an owner, verify access
    if (job.userId) {
      const isOwner = session?.user?.id === job.userId;
      const isAdmin =
        !!session?.user &&
        !session.user.isTeamLogin &&
        isAdminRole(session.user.role);
      if (!isOwner && !isAdmin) {
        // Return 404 instead of 403 to avoid revealing job existence
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }
    }
    // Guest jobs (no userId) remain accessible via job ID: the random uuid
    // in the notification email link is the access token (see header comment).

    // Calculate stats if completed
    let stats = null;
    if (job.status === "COMPLETED" && job.dnaSequence) {
      const gcCount = (job.dnaSequence.match(/[GC]/gi) || []).length;
      stats = {
        aminoAcidCount: job.proteinSequence.length,
        dnaLength: job.dnaSequence.length,
        gcContent:
          Math.round((gcCount / job.dnaSequence.length) * 10000) / 100,
      };
    }

    // Strip userId from response — internal field
    const { userId: _userId, proteinSequence, dnaSequence, ...jobData } = job;

    // Sequences are only useful once the job is done; drop them from the
    // polling payload until then (dnaSequence is null before completion anyway).
    const isCompleted = job.status === "COMPLETED";

    return NextResponse.json({
      job: {
        ...jobData,
        ...(isCompleted ? { proteinSequence, dnaSequence } : {}),
        stats,
      },
    });
  } catch (error) {
    console.error("Error fetching codon optimization job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}
