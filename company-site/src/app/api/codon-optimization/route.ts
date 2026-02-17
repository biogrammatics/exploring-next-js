import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateProteinSequence } from "@/lib/codon-optimization";

/**
 * POST /api/codon-optimization
 * Submit a new codon optimization job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      proteinSequence,
      proteinName,
      targetOrganism = "pichia",
      notificationEmail,
      excludedPatterns,
    } = body;

    // Validate required fields
    if (!proteinSequence || typeof proteinSequence !== "string") {
      return NextResponse.json(
        { error: "Protein sequence is required" },
        { status: 400 }
      );
    }

    // Validate the protein sequence
    const validation = validateProteinSequence(proteinSequence);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Invalid protein sequence",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Validate excluded patterns if provided
    const patterns: string[] = Array.isArray(excludedPatterns)
      ? excludedPatterns.filter((p: unknown) => typeof p === "string" && p.length > 0)
      : [];

    // Create the job
    const job = await prisma.codonOptimizationJob.create({
      data: {
        proteinSequence: validation.cleanedSequence,
        proteinName: proteinName || null,
        targetOrganism,
        notificationEmail: notificationEmail || session?.user?.email || null,
        userId: session?.user?.id || null,
        status: "PENDING",
        excludedEnzymeNames:
          patterns.length > 0 ? patterns.join(",") : null,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "Job submitted successfully",
      warnings: validation.warnings,
      sequenceLength: validation.length,
    });
  } catch (error) {
    console.error("Error submitting codon optimization job:", error);
    return NextResponse.json(
      { error: "Failed to submit job" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/codon-optimization
 * List jobs for the current user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required to list jobs" },
        { status: 401 }
      );
    }

    const jobs = await prisma.codonOptimizationJob.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        proteinName: true,
        targetOrganism: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Error listing codon optimization jobs:", error);
    return NextResponse.json(
      { error: "Failed to list jobs" },
      { status: 500 }
    );
  }
}
