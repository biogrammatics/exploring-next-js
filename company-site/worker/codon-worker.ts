/**
 * Codon Optimization Background Worker
 *
 * This worker polls the database for pending codon optimization jobs
 * and processes them. It runs as a separate service on Render.
 *
 * Usage: npx tsx worker/codon-worker.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../src/generated/prisma");
import { Resend } from "resend";

// Initialize clients
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;

// ============================================================================
// CODON OPTIMIZATION ALGORITHM
// (Duplicated from src/lib/codon-optimization.ts to avoid Next.js imports)
// ============================================================================

const CODON_TABLE: Record<string, string[]> = {
  'A': ['GCT', 'GCC', 'GCA', 'GCG'],
  'V': ['GTT', 'GTC', 'GTA', 'GTG'],
  'L': ['TTA', 'TTG', 'CTT', 'CTC', 'CTA', 'CTG'],
  'I': ['ATT', 'ATC', 'ATA'],
  'M': ['ATG'],
  'F': ['TTT', 'TTC'],
  'W': ['TGG'],
  'P': ['CCT', 'CCC', 'CCA', 'CCG'],
  'S': ['TCT', 'TCC', 'TCA', 'TCG', 'AGT', 'AGC'],
  'T': ['ACT', 'ACC', 'ACA', 'ACG'],
  'N': ['AAT', 'AAC'],
  'Q': ['CAA', 'CAG'],
  'Y': ['TAT', 'TAC'],
  'C': ['TGT', 'TGC'],
  'G': ['GGT', 'GGC', 'GGA', 'GGG'],
  'K': ['AAA', 'AAG'],
  'R': ['CGT', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'],
  'H': ['CAT', 'CAC'],
  'D': ['GAT', 'GAC'],
  'E': ['GAA', 'GAG'],
  '*': ['TAA', 'TAG', 'TGA'],
};

function resolveAmbiguousAminoAcid(aa: string): string {
  switch (aa) {
    case 'B': return Math.random() < 0.5 ? 'D' : 'N';
    case 'Z': return Math.random() < 0.5 ? 'E' : 'Q';
    case 'J': return Math.random() < 0.5 ? 'L' : 'I';
    case 'U': return 'C';
    case 'O': return 'K';
    case 'X': {
      const standardAAs = 'ACDEFGHIKLMNPQRSTVWY';
      return standardAAs[Math.floor(Math.random() * standardAAs.length)];
    }
    default: return aa;
  }
}

function selectCodon(aminoAcid: string): string {
  const resolvedAA = resolveAmbiguousAminoAcid(aminoAcid);
  const codons = CODON_TABLE[resolvedAA];
  if (!codons || codons.length === 0) {
    throw new Error(`No codons found for amino acid: ${aminoAcid}`);
  }
  return codons[Math.floor(Math.random() * codons.length)];
}

function optimizeCodon(proteinSequence: string): { success: boolean; dnaSequence?: string; error?: string } {
  try {
    const codons: string[] = [];
    for (const aa of proteinSequence) {
      const codon = selectCodon(aa);
      codons.push(codon);
    }
    return { success: true, dnaSequence: codons.join('') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function getCompletionEmailHtml(jobId: string, proteinName: string | null, baseUrl: string): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

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
      Your codon optimization job${proteinName ? ` for <strong>${proteinName}</strong>` : ''} has been completed successfully.
    </p>

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

function getCompletionEmailText(jobId: string, proteinName: string | null, baseUrl: string): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

  return `Codon Optimization Complete - BioGrammatics

Your codon optimization job${proteinName ? ` for ${proteinName}` : ''} has been completed successfully.

View your results: ${jobUrl}

Click the link above to view and download your optimized DNA sequence.

---

BioGrammatics, Inc.
Protein Expression Experts
`;
}

function getFailureEmailHtml(jobId: string, proteinName: string | null, errorMessage: string, baseUrl: string): string {
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
      Unfortunately, your codon optimization job${proteinName ? ` for <strong>${proteinName}</strong>` : ''} encountered an error.
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

function getFailureEmailText(jobId: string, proteinName: string | null, errorMessage: string, baseUrl: string): string {
  const jobUrl = `${baseUrl}/codon-optimization?job=${jobId}`;

  return `Codon Optimization Failed - BioGrammatics

Unfortunately, your codon optimization job${proteinName ? ` for ${proteinName}` : ''} encountered an error.

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

    // Perform codon optimization
    const result = optimizeCodon(job.proteinSequence);

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

      console.log(`[${new Date().toISOString()}] Job ${jobId} completed successfully`);

      // Send notification email if requested
      if (job.notificationEmail) {
        await sendNotificationEmail(jobId, job.proteinName, job.notificationEmail, true);
      }
    } else {
      throw new Error(result.error || "Unknown optimization error");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${new Date().toISOString()}] Job ${jobId} failed:`, errorMessage);

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
      await sendNotificationEmail(jobId, job.proteinName, job.notificationEmail, false, errorMessage);
    }
  }
}

async function sendNotificationEmail(
  jobId: string,
  proteinName: string | null,
  email: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://beta.biogrammatics.com";
  const fromAddress = process.env.EMAIL_FROM || "BioGrammatics <noreply@links.biogrammatics.com>";

  try {
    if (success) {
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: `Codon Optimization Complete${proteinName ? `: ${proteinName}` : ''}`,
        html: getCompletionEmailHtml(jobId, proteinName, baseUrl),
        text: getCompletionEmailText(jobId, proteinName, baseUrl),
      });
    } else {
      await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: `Codon Optimization Failed${proteinName ? `: ${proteinName}` : ''}`,
        html: getFailureEmailHtml(jobId, proteinName, errorMessage || "Unknown error", baseUrl),
        text: getFailureEmailText(jobId, proteinName, errorMessage || "Unknown error", baseUrl),
      });
    }

    // Mark email as sent
    await prisma.codonOptimizationJob.update({
      where: { id: jobId },
      data: { emailSentAt: new Date() },
    });

    console.log(`[${new Date().toISOString()}] Notification email sent for job ${jobId}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to send notification email for job ${jobId}:`, error);
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
    console.error(`[${new Date().toISOString()}] Error polling for jobs:`, error);
  }
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Codon optimization worker started`);
  console.log(`[${new Date().toISOString()}] Poll interval: ${POLL_INTERVAL_MS}ms`);

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
