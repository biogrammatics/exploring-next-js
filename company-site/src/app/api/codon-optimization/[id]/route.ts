import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
 *  - Guest jobs (no userId): accessible by job ID (link shared via notification email)
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
        session?.user?.role === "ADMIN" ||
        session?.user?.role === "SUPER_ADMIN";
      if (!isOwner && !isAdmin) {
        // Return 404 instead of 403 to avoid revealing job existence
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }
    }
    // Guest jobs (no userId) remain accessible via job ID — the UUID
    // in the notification email link serves as the access token

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
    const { userId: _userId, ...jobData } = job;

    return NextResponse.json({
      job: {
        ...jobData,
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
