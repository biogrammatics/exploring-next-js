import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateProteinSequence } from "@/lib/codon-optimization";
import {
  getEnzymesForPromoter,
  GOLDEN_GATE_ENZYMES,
} from "@/lib/restriction-enzymes";

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
      vectorName,
      goldenGateExclusion,
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

    // Resolve restriction enzyme exclusions based on vector and Golden Gate choices
    const excludedEnzymes: string[] = [];

    if (vectorName) {
      const vector = await prisma.vector.findUnique({
        where: { name: vectorName },
        include: { promoter: true },
      });
      if (!vector) {
        return NextResponse.json(
          { error: `Unknown vector: ${vectorName}` },
          { status: 400 }
        );
      }
      if (vector.promoter) {
        for (const enz of getEnzymesForPromoter(vector.promoter.name)) {
          if (!excludedEnzymes.includes(enz)) {
            excludedEnzymes.push(enz);
          }
        }
      }
    }

    if (goldenGateExclusion) {
      for (const enz of GOLDEN_GATE_ENZYMES) {
        if (!excludedEnzymes.includes(enz)) {
          excludedEnzymes.push(enz);
        }
      }
    }

    // Create the job
    const job = await prisma.codonOptimizationJob.create({
      data: {
        proteinSequence: validation.cleanedSequence,
        proteinName: proteinName || null,
        targetOrganism,
        notificationEmail: notificationEmail || session?.user?.email || null,
        userId: session?.user?.id || null,
        status: "PENDING",
        vectorName: vectorName || null,
        goldenGateExclusion: !!goldenGateExclusion,
        excludedEnzymeNames:
          excludedEnzymes.length > 0 ? excludedEnzymes.join(",") : null,
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
