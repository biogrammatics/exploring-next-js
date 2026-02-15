/**
 * Codon Optimization Background Worker
 *
 * This worker polls the database for pending codon optimization jobs
 * and processes them using DP optimization (primary) with beam search fallback.
 * It runs as a separate service on Render.
 *
 * Usage: npx tsx worker/codon-worker.ts
 */

import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../src/generated/prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");
import { Resend } from "resend";

// Import both optimizers (DP primary, beam search fallback)
import {
  DPCodonOptimizer,
  type NinemerScores,
  type DPOptimizationResult,
} from "../src/lib/dp-optimizer";
import {
  NinemerBeamSearchOptimizer,
  type OptimizationResult,
} from "../src/lib/beam-search-optimizer";
import { enzymeNamesToExclusionPatterns } from "../src/lib/restriction-enzymes";

// Initialize clients
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds
const BEAM_WIDTH = 100;

// Global optimizer instances (loaded once at startup)
let dpOptimizer: DPCodonOptimizer | null = null;
let beamOptimizer: NinemerBeamSearchOptimizer | null = null;

// ============================================================================
// DATA LOADING
// ============================================================================

function loadOptimizers(): void {
  const dataDir = path.join(__dirname, "..", "data", "codon-optimization");

  // Load 9-mer scoring matrix
  console.log(`[${new Date().toISOString()}] Loading 9-mer scoring matrix...`);
  const scoresPath = path.join(dataDir, "ninemer_scores.json");
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;
  console.log(
    `[${new Date().toISOString()}] Loaded ${Object.keys(ninemerScores).length} amino acid triplets`
  );

  // Load universal exclusion patterns
  const exclusionsPath = path.join(dataDir, "exclusions.txt");
  const exclusionPatterns = fs.readFileSync(exclusionsPath, "utf-8");

  // Initialize DP optimizer (primary)
  dpOptimizer = new DPCodonOptimizer(ninemerScores, {
    beamWidth: BEAM_WIDTH,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  // Initialize beam search optimizer (fallback)
  beamOptimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
    beamWidth: BEAM_WIDTH,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });
}

// ============================================================================
// PROTEIN SEQUENCE PREPROCESSING
// ============================================================================

/**
 * Preprocess protein sequence: handle ambiguous amino acids and validate
 */
function preprocessProteinSequence(sequence: string): {
  success: boolean;
  processedSequence?: string;
  error?: string;
} {
  // Remove whitespace and convert to uppercase
  let processed = sequence.replace(/\s/g, "").toUpperCase();

  // Handle ambiguous amino acids
  const processed_chars: string[] = [];
  for (const aa of processed) {
    switch (aa) {
      case "B": // Aspartate or Asparagine
        processed_chars.push(Math.random() < 0.5 ? "D" : "N");
        break;
      case "Z": // Glutamate or Glutamine
        processed_chars.push(Math.random() < 0.5 ? "E" : "Q");
        break;
      case "J": // Leucine or Isoleucine
        processed_chars.push(Math.random() < 0.5 ? "L" : "I");
        break;
      case "U": // Selenocysteine -> Cysteine
        processed_chars.push("C");
        break;
      case "O": // Pyrrolysine -> Lysine
        processed_chars.push("K");
        break;
      case "X": // Unknown -> random standard AA
        const standardAAs = "ACDEFGHIKLMNPQRSTVWY";
        processed_chars.push(
          standardAAs[Math.floor(Math.random() * standardAAs.length)]
        );
        break;
      default:
        // Standard amino acids
        if ("ACDEFGHIKLMNPQRSTVWY".includes(aa)) {
          processed_chars.push(aa);
        } else {
          return {
            success: false,
            error: `Invalid amino acid character: ${aa}`,
          };
        }
    }
  }

  return {
    success: true,
    processedSequence: processed_chars.join(""),
  };
}

/**
 * Perform codon optimization using DP (primary) with beam search fallback.
 * Accepts optional per-job exclusion patterns for restriction enzyme sites.
 */
function optimizeCodon(
  proteinSequence: string,
  additionalExclusionPatterns?: string
): DPOptimizationResult | OptimizationResult {
  if (!dpOptimizer || !beamOptimizer) {
    return { success: false, error: "Optimizers not initialized" };
  }

  // Preprocess the sequence
  const preprocessed = preprocessProteinSequence(proteinSequence);
  if (!preprocessed.success || !preprocessed.processedSequence) {
    return { success: false, error: preprocessed.error };
  }

  // Try DP optimizer first (primary)
  const dpResult = dpOptimizer.optimize(
    preprocessed.processedSequence,
    additionalExclusionPatterns
  );

  if (dpResult.success) {
    return dpResult;
  }

  // Fallback to beam search if DP fails
  console.log(
    `[${new Date().toISOString()}] DP optimizer failed, falling back to beam search: ${dpResult.error}`
  );
  return beamOptimizer.optimize(
    preprocessed.processedSequence,
    additionalExclusionPatterns
  );
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function getCompletionEmailHtml(
  jobId: string,
  proteinName: string | null,
  baseUrl: string,
  score?: number,
  elapsedMs?: number
): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;
  const scoreInfo =
    score !== undefined ? `<p style="color: #6b7280; font-size: 14px;">Optimization score: ${score.toLocaleString()}</p>` : "";
  const timeInfo =
    elapsedMs !== undefined
      ? `<p style="color: #6b7280; font-size: 14px;">Processing time: ${(elapsedMs / 1000).toFixed(1)}s</p>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">BioGrammatics</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Codon Optimization Complete!</h2>

    <p style="color: #4b5563;">
      Your codon optimization job${proteinName ? ` for <strong>${proteinName}</strong>` : ""} has been completed successfully.
    </p>

    ${scoreInfo}
    ${timeInfo}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${jobUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Results
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Click the button above to view and download your optimized DNA sequence.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${jobUrl}" style="color: #6b7280; word-break: break-all;">${jobUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">
      BioGrammatics, Inc.<br>
      Protein Expression Experts
    </p>
  </div>
</body>
</html>
`;
}

function getCompletionEmailText(
  jobId: string,
  proteinName: string | null,
  baseUrl: string
): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

  return `Codon Optimization Complete - BioGrammatics

Your codon optimization job${proteinName ? ` for ${proteinName}` : ""} has been completed successfully.

View your results: ${jobUrl}

Click the link above to view and download your optimized DNA sequence.

---

BioGrammatics, Inc.
Protein Expression Experts
`;
}

function getFailureEmailHtml(
  jobId: string,
  proteinName: string | null,
  errorMessage: string,
  baseUrl: string
): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">BioGrammatics</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Codon Optimization Failed</h2>

    <p style="color: #4b5563;">
      Unfortunately, your codon optimization job${proteinName ? ` for <strong>${proteinName}</strong>` : ""} encountered an error.
    </p>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="color: #991b1b; margin: 0; font-size: 14px;">
        <strong>Error:</strong> ${errorMessage}
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Please check your protein sequence and try again. If the problem persists, contact support.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${jobUrl}" style="display: inline-block; background: #6b7280; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Job Details
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">
      BioGrammatics, Inc.<br>
      Protein Expression Experts
    </p>
  </div>
</body>
</html>
`;
}

function getFailureEmailText(
  jobId: string,
  proteinName: string | null,
  errorMessage: string,
  baseUrl: string
): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

  return `Codon Optimization Failed - BioGrammatics

Unfortunately, your codon optimization job${proteinName ? ` for ${proteinName}` : ""} encountered an error.

Error: ${errorMessage}

Please check your protein sequence and try again. If the problem persists, contact support.

View job details: ${jobUrl}

---

BioGrammatics, Inc.
Protein Expression Experts
`;
}

// ============================================================================
// WORKER LOGIC
// ============================================================================

async function processJob(jobId: string): Promise<void> {
  console.log(`[${new Date().toISOString()}] Processing job: ${jobId}`);

  try {
    // Mark job as processing
    const job = await prisma.codonOptimizationJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });

    // Build per-job exclusion patterns from stored enzyme names
    let additionalExclusionPatterns: string | undefined;
    if (job.excludedEnzymeNames) {
      const enzymeNames = job.excludedEnzymeNames.split(",");
      additionalExclusionPatterns =
        enzymeNamesToExclusionPatterns(enzymeNames);
    }

    // Perform codon optimization
    const result = optimizeCodon(
      job.proteinSequence,
      additionalExclusionPatterns
    );

    if (result.success && result.dnaSequence) {
      // Update job with results
      await prisma.codonOptimizationJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          dnaSequence: result.dnaSequence,
          completedAt: new Date(),
        },
      });

      console.log(
        `[${new Date().toISOString()}] Job ${jobId} completed successfully (score: ${result.score}, time: ${result.elapsedMs}ms)`
      );

      // Send notification email if requested
      if (job.notificationEmail) {
        await sendNotificationEmail(
          jobId,
          job.proteinName,
          job.notificationEmail,
          true,
          undefined,
          result.score,
          result.elapsedMs
        );
      }
    } else {
      throw new Error(result.error || "Unknown optimization error");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[${new Date().toISOString()}] Job ${jobId} failed:`,
      errorMessage
    );

    // Get job for notification email
    const job = await prisma.codonOptimizationJob.findUnique({
      where: { id: jobId },
    });

    // Update job with error
    await prisma.codonOptimizationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    // Send failure notification if email was provided
    if (job?.notificationEmail) {
      await sendNotificationEmail(
        jobId,
        job.proteinName,
        job.notificationEmail,
        false,
        errorMessage
      );
    }
  }
}

async function sendNotificationEmail(
  jobId: string,
  proteinName: string | null,
  email: string,
  success: boolean,
  errorMessage?: string,
  score?: number,
  elapsedMs?: number
): Promise<void> {
  const baseUrl =
    process.env.NEXTAUTH_URL || "https://beta.biogrammatics.com";
  const fromAddress =
    process.env.EMAIL_FROM || "BioGrammatics <noreply@links.biogrammatics.com>";

  try {
    if (success) {
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: `Codon Optimization Complete${proteinName ? `: ${proteinName}` : ""}`,
        html: getCompletionEmailHtml(jobId, proteinName, baseUrl, score, elapsedMs),
        text: getCompletionEmailText(jobId, proteinName, baseUrl),
      });
    } else {
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: `Codon Optimization Failed${proteinName ? `: ${proteinName}` : ""}`,
        html: getFailureEmailHtml(
          jobId,
          proteinName,
          errorMessage || "Unknown error",
          baseUrl
        ),
        text: getFailureEmailText(
          jobId,
          proteinName,
          errorMessage || "Unknown error",
          baseUrl
        ),
      });
    }

    // Mark email as sent
    await prisma.codonOptimizationJob.update({
      where: { id: jobId },
      data: { emailSentAt: new Date() },
    });

    console.log(
      `[${new Date().toISOString()}] Notification email sent for job ${jobId}`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Failed to send notification email for job ${jobId}:`,
      error
    );
  }
}

async function pollForJobs(): Promise<void> {
  try {
    // Find the next pending job
    const pendingJob = await prisma.codonOptimizationJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (pendingJob) {
      await processJob(pendingJob.id);
    }
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error polling for jobs:`,
      error
    );
  }
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Codon optimization worker started`);
  console.log(`[${new Date().toISOString()}] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[${new Date().toISOString()}] Beam width: ${BEAM_WIDTH}`);

  // Load both optimizers on startup
  loadOptimizers();
  console.log(`[${new Date().toISOString()}] Optimizers initialized (DP primary, beam search fallback)`);

  // Main loop
  while (true) {
    await pollForJobs();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  console.error("Worker failed:", error);
  process.exit(1);
});
