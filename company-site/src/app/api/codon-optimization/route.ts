import { NextRequest, NextResponse } from "next/server";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  validateProteinSequence,
  validateExclusionPattern,
  MAX_PROTEIN_LENGTH,
  MAX_EXCLUSION_PATTERNS,
} from "@/lib/codon-optimization";
import { isValidEmail, normalizeEmail } from "@/lib/identity";

/**
 * Raw request-body cap for the protein sequence, applied before the (O(n))
 * cleaning/validation pass. Allows headroom for whitespace, digits and line
 * numbering in pasted FASTA-style input.
 */
const MAX_RAW_SEQUENCE_CHARS = Math.floor(MAX_PROTEIN_LENGTH * 1.5);
const MAX_PROTEIN_NAME_LENGTH = 200;

/** Strip C0/C1 control characters (the name ends up in an email subject). */
function sanitizeProteinName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, MAX_PROTEIN_NAME_LENGTH);
}

/**
 * POST /api/codon-optimization
 * Submit a new codon optimization job
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimitResponse(RATE_LIMITS.codonSubmit, request.headers);
    if (limited) return limited;

    const session = await auth();
    const body = await request.json();

    const {
      proteinSequence,
      proteinName,
      targetOrganism = "pichia",
      notificationEmail,
      excludedPatterns,
    } = body ?? {};

    // Validate required fields
    if (!proteinSequence || typeof proteinSequence !== "string") {
      return NextResponse.json(
        { error: "Protein sequence is required" },
        { status: 400 }
      );
    }

    // Cheap early exit before running the cleaning pass on a huge payload
    if (proteinSequence.length > MAX_RAW_SEQUENCE_CHARS) {
      return NextResponse.json(
        {
          error: `Protein sequence is too long. Maximum is ${MAX_PROTEIN_LENGTH.toLocaleString()} amino acids.`,
        },
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

    if (typeof targetOrganism !== "string" || targetOrganism.length > 50) {
      return NextResponse.json(
        { error: "Invalid target organism" },
        { status: 400 }
      );
    }

    // Validate excluded patterns if provided. Patterns are compiled to regex by
    // the worker and stored comma-joined, so each must pass the safe-alphabet
    // check in validateExclusionPattern.
    let patterns: string[] = [];
    if (excludedPatterns !== undefined && excludedPatterns !== null) {
      if (!Array.isArray(excludedPatterns)) {
        return NextResponse.json(
          { error: "excludedPatterns must be an array of strings" },
          { status: 400 }
        );
      }
      if (excludedPatterns.length > MAX_EXCLUSION_PATTERNS) {
        return NextResponse.json(
          { error: `At most ${MAX_EXCLUSION_PATTERNS} exclusion patterns are allowed` },
          { status: 400 }
        );
      }
      for (const raw of excludedPatterns) {
        const check = validateExclusionPattern(raw);
        if (!check.ok) {
          const shown =
            typeof raw === "string" ? raw.slice(0, 80) : String(raw);
          return NextResponse.json(
            { error: `Invalid exclusion pattern "${shown}": ${check.reason}` },
            { status: 400 }
          );
        }
      }
      patterns = excludedPatterns as string[];
    }

    // Notification email: optional for signed-in users (falls back to the
    // account email), required for guests (it is the only way they get the
    // result link).
    let storedEmail: string | null = null;
    if (notificationEmail !== undefined && notificationEmail !== null && notificationEmail !== "") {
      if (!isValidEmail(notificationEmail)) {
        return NextResponse.json(
          { error: "Invalid notification email address" },
          { status: 400 }
        );
      }
      storedEmail = normalizeEmail(notificationEmail);
    } else if (session?.user?.email) {
      storedEmail = normalizeEmail(session.user.email);
    }

    if (!session?.user && !storedEmail) {
      return NextResponse.json(
        {
          error:
            "A notification email is required to submit a job without signing in",
        },
        { status: 400 }
      );
    }

    // Create the job
    const job = await prisma.codonOptimizationJob.create({
      data: {
        proteinSequence: validation.cleanedSequence,
        proteinName: sanitizeProteinName(proteinName ?? validation.fastaHeader),
        targetOrganism,
        notificationEmail: storedEmail,
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
