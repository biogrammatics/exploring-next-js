/**
 * Export 100 DP-optimized DNA sequences from the human proteome
 *
 * Reads UP000005640_9606.fasta, filters to 400-700 AA proteins with
 * only standard amino acids, optimizes the first 100 valid ones using
 * the DP optimizer with restriction enzyme exclusions, and writes
 * the results to a FASTA file.
 *
 * Run: npx tsx worker/export-optimized-100.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  DPCodonOptimizer,
  type NinemerScores,
} from "../src/lib/dp-optimizer";
import { enzymeNamesToExclusionPatterns } from "../src/lib/restriction-enzymes";

// Valid standard amino acids
const VALID_AA = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));

// Parse FASTA file (UniProt format)
function parseFasta(content: string): Array<{ header: string; sequence: string }> {
  const entries: Array<{ header: string; sequence: string }> = [];
  let currentHeader = "";
  let currentSeq: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      if (currentHeader && currentSeq.length > 0) {
        entries.push({ header: currentHeader, sequence: currentSeq.join("") });
      }
      currentHeader = trimmed.slice(1); // remove leading '>'
      currentSeq = [];
    } else if (trimmed) {
      currentSeq.push(trimmed);
    }
  }
  if (currentHeader && currentSeq.length > 0) {
    entries.push({ header: currentHeader, sequence: currentSeq.join("") });
  }

  return entries;
}

// Check if a protein sequence contains only standard amino acids
function hasOnlyStandardAA(seq: string): boolean {
  for (const aa of seq) {
    if (!VALID_AA.has(aa)) return false;
  }
  return true;
}

// Wrap a sequence at a given line width
function wrapSequence(seq: string, width: number): string {
  const lines: string[] = [];
  for (let i = 0; i < seq.length; i += width) {
    lines.push(seq.slice(i, i + width));
  }
  return lines.join("\n");
}

async function main() {
  const TARGET_COUNT = 100;
  const MIN_LEN = 400;
  const MAX_LEN = 700;
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
  const fastaPath = "/Users/tom/Claude/codon-optimization/UP000005640_9606.fasta";
  if (!fs.existsSync(fastaPath)) {
    console.error(`FASTA file not found: ${fastaPath}`);
    process.exit(1);
  }
  console.log("Loading FASTA file...");
  const fastaContent = fs.readFileSync(fastaPath, "utf-8");
  const allProteins = parseFasta(fastaContent);
  console.log(`Loaded ${allProteins.length} total proteins`);

  // Filter to 400-700 AA with only standard amino acids
  const candidates = allProteins.filter(
    (p) =>
      p.sequence.length >= MIN_LEN &&
      p.sequence.length <= MAX_LEN &&
      hasOnlyStandardAA(p.sequence)
  );
  console.log(
    `Filtered to ${candidates.length} proteins with ${MIN_LEN}-${MAX_LEN} AA and standard amino acids only`
  );

  if (candidates.length < TARGET_COUNT) {
    console.error(
      `Not enough candidate proteins (${candidates.length} < ${TARGET_COUNT})`
    );
    process.exit(1);
  }

  // Create DP optimizer
  const optimizer = new DPCodonOptimizer(ninemerScores, {
    beamWidth: 100,
    pathsPerState: 8,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  // Per-job restriction enzyme exclusions
  const perJobEnzymes = ["PmeI", "EcoRV", "AleI", "BsaI"];
  const additionalExclusionPatterns =
    enzymeNamesToExclusionPatterns(perJobEnzymes);
  console.log(`\nRestriction enzyme exclusions: ${perJobEnzymes.join(", ")}`);
  console.log(`Additional patterns:\n${additionalExclusionPatterns}\n`);

  // Optimize proteins
  const results: Array<{
    header: string;
    dnaSequence: string;
    aaLength: number;
    score: number;
    elapsedMs: number;
  }> = [];
  let attempted = 0;
  let skipped = 0;
  const startTime = Date.now();

  console.log("=".repeat(80));
  console.log(
    `DP OPTIMIZER -- Targeting ${TARGET_COUNT} proteins (${MIN_LEN}-${MAX_LEN} AA)`
  );
  console.log("=".repeat(80));

  for (const candidate of candidates) {
    if (results.length >= TARGET_COUNT) break;

    attempted++;
    const { header, sequence } = candidate;
    const shortHeader =
      header.split(" ")[0].length > 30
        ? header.split(" ")[0].slice(0, 30)
        : header.split(" ")[0];

    const result = optimizer.optimize(sequence, additionalExclusionPatterns);

    if (result.success && result.dnaSequence) {
      results.push({
        header,
        dnaSequence: result.dnaSequence,
        aaLength: sequence.length,
        score: result.score!,
        elapsedMs: result.elapsedMs!,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  [${results.length.toString().padStart(3)}/${TARGET_COUNT}] ` +
          `${shortHeader.padEnd(32)} ` +
          `${sequence.length.toString().padStart(4)} AA  ` +
          `score=${result.score!.toLocaleString().padStart(8)}  ` +
          `${result.elapsedMs!.toString().padStart(5)}ms  ` +
          `(${elapsed}s elapsed)`
      );
    } else {
      skipped++;
      console.log(
        `  [SKIP] ${shortHeader.padEnd(32)} ` +
          `${sequence.length.toString().padStart(4)} AA  ` +
          `Error: ${result.error}`
      );
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Write output FASTA with numbered names and TAA stop codon
  const outputPath =
    "/Users/tom/Claude/codon-optimization/dp_optimized_100.fasta";
  const fastaLines: string[] = [];
  const mappingLines: string[] = ["#\tUniProt_ID\tAA_len\tDNA_len\tScore"];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const num = (i + 1).toString().padStart(3, "0");
    const dnaWithStop = r.dnaSequence + "TAA";
    const uniprotId = r.header.split(" ")[0];

    fastaLines.push(`>opt${num}`);
    fastaLines.push(wrapSequence(dnaWithStop, 80));
    mappingLines.push(
      `${num}\t${uniprotId}\t${r.aaLength}\t${dnaWithStop.length}\t${r.score}`
    );
  }

  fs.writeFileSync(outputPath, fastaLines.join("\n") + "\n");

  // Write mapping file so we can trace numbers back to proteins
  const mappingPath =
    "/Users/tom/Claude/codon-optimization/dp_optimized_100_mapping.tsv";
  fs.writeFileSync(mappingPath, mappingLines.join("\n") + "\n");

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Candidates in ${MIN_LEN}-${MAX_LEN} AA range: ${candidates.length}`);
  console.log(`Attempted:  ${attempted}`);
  console.log(`Succeeded:  ${results.length}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Total time: ${totalElapsed}s`);

  if (results.length > 0) {
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const totalTime = results.reduce((s, r) => s + r.elapsedMs, 0);
    const avgLen = results.reduce((s, r) => s + r.aaLength, 0) / results.length;
    const minLen = Math.min(...results.map((r) => r.aaLength));
    const maxLen = Math.max(...results.map((r) => r.aaLength));

    console.log(`\nAvg score:  ${(totalScore / results.length).toFixed(0)}`);
    console.log(
      `Avg score/AA: ${(totalScore / results.reduce((s, r) => s + r.aaLength, 0)).toFixed(1)}`
    );
    console.log(
      `Optimizer time: ${(totalTime / 1000).toFixed(1)}s (avg ${(totalTime / results.length).toFixed(0)}ms/protein)`
    );
    console.log(
      `AA lengths: min=${minLen}, avg=${avgLen.toFixed(0)}, max=${maxLen}`
    );
  }

  console.log(`\nOutput written to: ${outputPath}`);
  console.log(`  ${results.length} sequences (named opt001-opt${results.length.toString().padStart(3, "0")}, each with TAA stop)`);
  console.log(`Mapping written to: ${mappingPath}`);

  if (results.length < TARGET_COUNT) {
    console.error(
      `\nWARNING: Only ${results.length}/${TARGET_COUNT} optimizations succeeded!`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
