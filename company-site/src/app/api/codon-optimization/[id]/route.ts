import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/codon-optimization/[id]
 * Get the status and results of a specific job
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const job = await prisma.codonOptimizationJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        proteinSequence: true,
        proteinName: true,
        targetOrganism: true,
        dnaSequence: true,
        errorMessage: true,
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

    // Calculate stats if completed
    let stats = null;
    if (job.status === "COMPLETED" && job.dnaSequence) {
      const gcCount = (job.dnaSequence.match(/[GC]/gi) || []).length;
      stats = {
        aminoAcidCount: job.proteinSequence.length,
        dnaLength: job.dnaSequence.length,
        gcContent: Math.round((gcCount / job.dnaSequence.length) * 10000) / 100,
      };
    }

    return NextResponse.json({
      job: {
        ...job,
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
