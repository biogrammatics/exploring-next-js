/**
 * Test both optimizers against the full human proteome (UP000005640_9606.fasta)
 * Run: npx tsx worker/test-proteome.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "../src/lib/beam-search-optimizer";
import {
  DPCodonOptimizer,
  type NinemerScores as DPNinemerScores,
} from "../src/lib/dp-optimizer";
import { enzymeNamesToExclusionPatterns } from "../src/lib/restriction-enzymes";

// Valid amino acids for our optimizers
const VALID_AA = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));

// Parse FASTA file (UniProt format: >sp|ID|NAME OS=... lines)
function parseFasta(content: string): Array<{ name: string; sequence: string }> {
  const entries: Array<{ name: string; sequence: string }> = [];
  let currentName = "";
  let currentSeq: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      if (currentName && currentSeq.length > 0) {
        entries.push({ name: currentName, sequence: currentSeq.join("") });
      }
      currentName = trimmed.slice(1);
      currentSeq = [];
    } else if (trimmed) {
      currentSeq.push(trimmed);
    }
  }
  if (currentName && currentSeq.length > 0) {
    entries.push({ name: currentName, sequence: currentSeq.join("") });
  }

  return entries;
}

// Extract short name from UniProt FASTA header
function shortName(header: string): string {
  // >sp|P12345|PROT_HUMAN ... → sp|P12345|PROT_HUMAN
  const parts = header.split(" ");
  const id = parts[0];
  return id.length > 30 ? id.slice(0, 30) : id;
}

// Check if a protein sequence contains only valid amino acids
function hasInvalidAA(seq: string): string[] {
  const invalid: string[] = [];
  for (const aa of seq) {
    if (!VALID_AA.has(aa) && !invalid.includes(aa)) {
      invalid.push(aa);
    }
  }
  return invalid;
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data", "codon-optimization");

  // Load scoring matrix
  console.log("Loading 9-mer scoring matrix...");
  const scoresPath = path.join(dataDir, "ninemer_scores.json");
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;
  console.log(`Loaded ${Object.keys(ninemerScores).length} amino acid triplets`);

  // Load exclusion patterns
  const exclusionsPath = path.join(dataDir, "exclusions.txt");
  const exclusionPatterns = fs.readFileSync(exclusionsPath, "utf-8");

  // Load FASTA file
  const fastaPath = path.join(__dirname, "..", "..", "..", "codon-optimization", "UP000005640_9606.fasta");
  if (!fs.existsSync(fastaPath)) {
    console.error(`FASTA file not found: ${fastaPath}`);
    process.exit(1);
  }
  console.log("Loading FASTA file...");
  const fastaContent = fs.readFileSync(fastaPath, "utf-8");
  const allProteins = parseFasta(fastaContent);
  console.log(`Loaded ${allProteins.length} proteins from UP000005640_9606.fasta`);

  // Filter out proteins with invalid amino acids (e.g., U=selenocysteine, X=unknown)
  const skipped: Array<{ name: string; reason: string }> = [];
  const proteins: Array<{ name: string; sequence: string }> = [];

  for (const p of allProteins) {
    // Skip very short sequences (need at least 2 AA for 9-mer scoring)
    if (p.sequence.length < 2) {
      skipped.push({ name: shortName(p.name), reason: `too short (${p.sequence.length} AA)` });
      continue;
    }

    const invalidAAs = hasInvalidAA(p.sequence);
    if (invalidAAs.length > 0) {
      skipped.push({ name: shortName(p.name), reason: `invalid AA: ${invalidAAs.join(",")}` });
      continue;
    }

    proteins.push(p);
  }

  console.log(`Valid proteins for optimization: ${proteins.length}`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} proteins (invalid/ambiguous amino acids or too short)`);
  }

  // Create both optimizers
  const beamOptimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
    beamWidth: 100,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  const dpOptimizer = new DPCodonOptimizer(ninemerScores as DPNinemerScores, {
    beamWidth: 100,
    pathsPerState: 8,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  // Per-job restriction enzyme exclusions
  const perJobEnzymes = ["PmeI", "EcoRV", "AleI", "BsaI"];
  const additionalExclusionPatterns = enzymeNamesToExclusionPatterns(perJobEnzymes);
  console.log(`\nRestriction enzyme exclusions: ${perJobEnzymes.join(", ")}`);
  console.log(`Additional patterns:\n${additionalExclusionPatterns}\n`);

  // Track results
  const beamFailures: Array<{ name: string; error: string; length: number }> = [];
  const dpFailures: Array<{ name: string; error: string; length: number }> = [];
  let beamTotalTime = 0;
  let dpTotalTime = 0;
  let beamTotalScore = 0;
  let dpTotalScore = 0;
  let beamSuccesses = 0;
  let dpSuccesses = 0;

  const startTime = Date.now();
  const progressInterval = 500; // print every 500 proteins
  let dpBetterCount = 0;
  let beamBetterCount = 0;
  let tiedCount = 0;

  console.log("=" .repeat(80));
  console.log(`BEAM SEARCH vs DP OPTIMIZER — ${proteins.length} proteins`);
  console.log(`Exclusions: ${perJobEnzymes.join(", ")}`);
  console.log("=" .repeat(80));

  for (let i = 0; i < proteins.length; i++) {
    const { name, sequence } = proteins[i];
    const sn = shortName(name);

    // Progress reporting
    if ((i + 1) % progressInterval === 0 || i === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = i > 0 ? (i / ((Date.now() - startTime) / 1000)).toFixed(1) : "—";
      process.stdout.write(
        `\r  Progress: ${i + 1}/${proteins.length} (${elapsed}s, ${rate} prot/s) | ` +
        `Beam: ${beamSuccesses} ok, ${beamFailures.length} fail | ` +
        `DP: ${dpSuccesses} ok, ${dpFailures.length} fail`
      );
    }

    // Run beam search
    const beamResult = beamOptimizer.optimize(sequence, additionalExclusionPatterns);

    // Run DP
    const dpResult = dpOptimizer.optimize(sequence, additionalExclusionPatterns);

    // Collect beam stats
    if (beamResult.success) {
      beamSuccesses++;
      beamTotalTime += beamResult.elapsedMs!;
      beamTotalScore += beamResult.score!;
    } else {
      beamFailures.push({ name: sn, error: beamResult.error!, length: sequence.length });
    }

    // Collect DP stats
    if (dpResult.success) {
      dpSuccesses++;
      dpTotalTime += dpResult.elapsedMs!;
      dpTotalScore += dpResult.score!;
    } else {
      dpFailures.push({ name: sn, error: dpResult.error!, length: sequence.length });
    }

    // Score comparison for proteins where both succeed
    if (beamResult.success && dpResult.success) {
      if (dpResult.score! > beamResult.score!) dpBetterCount++;
      else if (beamResult.score! > dpResult.score!) beamBetterCount++;
      else tiedCount++;
    }

    // Print failures as they occur
    if (!beamResult.success) {
      process.stdout.write("\n");
      console.log(`  ❌ BEAM FAIL #${beamFailures.length}: ${sn} (${sequence.length} AA) — ${beamResult.error}`);
    }
    if (!dpResult.success) {
      process.stdout.write("\n");
      console.log(`  ❌ DP FAIL #${dpFailures.length}: ${sn} (${sequence.length} AA) — ${dpResult.error}`);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final summary
  console.log("\n\n" + "=" .repeat(80));
  console.log("SUMMARY");
  console.log("=" .repeat(80));
  console.log(`Total proteins tested: ${proteins.length} (${skipped.length} skipped)`);
  console.log(`Total time: ${totalElapsed}s`);
  console.log(`Exclusions: ${perJobEnzymes.join(", ")}\n`);

  console.log("BEAM SEARCH:");
  console.log(`  Succeeded: ${beamSuccesses}/${proteins.length}`);
  console.log(`  Failed:    ${beamFailures.length}`);
  if (beamSuccesses > 0) {
    console.log(`  Avg score: ${(beamTotalScore / beamSuccesses).toFixed(0)}`);
    console.log(`  Total optimizer time: ${(beamTotalTime / 1000).toFixed(1)}s`);
  }

  console.log("\nDP OPTIMIZER:");
  console.log(`  Succeeded: ${dpSuccesses}/${proteins.length}`);
  console.log(`  Failed:    ${dpFailures.length}`);
  if (dpSuccesses > 0) {
    console.log(`  Avg score: ${(dpTotalScore / dpSuccesses).toFixed(0)}`);
    console.log(`  Total optimizer time: ${(dpTotalTime / 1000).toFixed(1)}s`);
  }

  // Score comparison (only for proteins where both succeed)
  const bothSucceeded = beamSuccesses + dpSuccesses - proteins.length + beamFailures.length + dpFailures.length;
  console.log(`\nSCORE COMPARISON (both succeeded on ${proteins.length - beamFailures.length - dpFailures.length + Math.min(beamFailures.length, dpFailures.length)} proteins):`);
  console.log(`  DP better:   ${dpBetterCount}`);
  console.log(`  Beam better: ${beamBetterCount}`);
  console.log(`  Tied:        ${tiedCount}`);

  if (beamFailures.length > 0) {
    console.log(`\n${"—".repeat(80)}`);
    console.log(`BEAM SEARCH FAILURES (${beamFailures.length}):`);
    console.log(`${"—".repeat(80)}`);
    for (let i = 0; i < beamFailures.length; i++) {
      const f = beamFailures[i];
      console.log(`  ${(i + 1).toString().padStart(3)}. ${f.name} (${f.length} AA)`);
      console.log(`       Error: ${f.error}`);
    }
  }

  if (dpFailures.length > 0) {
    console.log(`\n${"—".repeat(80)}`);
    console.log(`DP OPTIMIZER FAILURES (${dpFailures.length}):`);
    console.log(`${"—".repeat(80)}`);
    for (let i = 0; i < dpFailures.length; i++) {
      const f = dpFailures[i];
      console.log(`  ${(i + 1).toString().padStart(3)}. ${f.name} (${f.length} AA)`);
      console.log(`       Error: ${f.error}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n${"—".repeat(80)}`);
    console.log(`SKIPPED PROTEINS (${skipped.length}):`);
    console.log(`${"—".repeat(80)}`);
    // Group by reason
    const byReason = new Map<string, number>();
    for (const s of skipped) {
      const key = s.reason.startsWith("invalid AA") ? "invalid/ambiguous amino acids" : s.reason;
      byReason.set(key, (byReason.get(key) || 0) + 1);
    }
    for (const [reason, count] of byReason) {
      console.log(`  ${count} proteins: ${reason}`);
    }
  }

  if (beamFailures.length === 0 && dpFailures.length === 0) {
    console.log("\n✅ No failures from either optimizer!");
  }

  // Exit with non-zero if there were DP failures
  if (dpFailures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
