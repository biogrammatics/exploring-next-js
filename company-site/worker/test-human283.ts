/**
 * Test both optimizers against the human283.fa dataset
 * Run: npx tsx worker/test-human283.ts
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

// Parse FASTA file
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
  const fastaPath = path.join(__dirname, "..", "..", "..", "codon-optimization", "human283.fa");
  const fastaContent = fs.readFileSync(fastaPath, "utf-8");
  const proteins = parseFasta(fastaContent);
  console.log(`Loaded ${proteins.length} proteins from human283.fa\n`);

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

  // Simulate per-job restriction enzyme exclusions (AOX1 vector + Golden Gate)
  const perJobEnzymes = ["PmeI", "SwaI", "BsaI", "BbsI", "BsmBI", "SapI"];
  const additionalExclusionPatterns = enzymeNamesToExclusionPatterns(perJobEnzymes);
  console.log(`Per-job restriction enzyme exclusions: ${perJobEnzymes.join(", ")}`);
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

  console.log("=" .repeat(90));
  console.log("BEAM SEARCH vs DP OPTIMIZER - human283.fa");
  console.log("=" .repeat(90));
  console.log(
    `${"#".padStart(4)} ${"Protein".padEnd(25)} ${"Len".padStart(5)} | ` +
    `${"Beam Score".padStart(12)} ${"Time".padStart(8)} | ` +
    `${"DP Score".padStart(12)} ${"Time".padStart(8)} | Delta`
  );
  console.log("-" .repeat(90));

  for (let i = 0; i < proteins.length; i++) {
    const { name, sequence } = proteins[i];
    const shortName = name.length > 24 ? name.slice(0, 24) : name;

    // Run beam search (with per-job restriction enzyme exclusions)
    const beamResult = beamOptimizer.optimize(sequence, additionalExclusionPatterns);

    // Run DP (with per-job restriction enzyme exclusions)
    const dpResult = dpOptimizer.optimize(sequence, additionalExclusionPatterns);

    // Collect stats
    let beamScoreStr: string;
    let beamTimeStr: string;
    if (beamResult.success) {
      beamSuccesses++;
      beamTotalTime += beamResult.elapsedMs!;
      beamTotalScore += beamResult.score!;
      beamScoreStr = beamResult.score!.toLocaleString();
      beamTimeStr = `${beamResult.elapsedMs}ms`;
    } else {
      beamFailures.push({ name, error: beamResult.error!, length: sequence.length });
      beamScoreStr = "FAIL";
      beamTimeStr = "-";
    }

    let dpScoreStr: string;
    let dpTimeStr: string;
    if (dpResult.success) {
      dpSuccesses++;
      dpTotalTime += dpResult.elapsedMs!;
      dpTotalScore += dpResult.score!;
      dpScoreStr = dpResult.score!.toLocaleString();
      dpTimeStr = `${dpResult.elapsedMs}ms`;
    } else {
      dpFailures.push({ name, error: dpResult.error!, length: sequence.length });
      dpScoreStr = "FAIL";
      dpTimeStr = "-";
    }

    // Score delta
    let deltaStr = "";
    if (beamResult.success && dpResult.success) {
      const delta = dpResult.score! - beamResult.score!;
      deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    } else if (!beamResult.success && dpResult.success) {
      deltaStr = "DP wins";
    } else if (beamResult.success && !dpResult.success) {
      deltaStr = "Beam wins";
    } else {
      deltaStr = "Both fail";
    }

    console.log(
      `${(i + 1).toString().padStart(4)} ${shortName.padEnd(25)} ${sequence.length.toString().padStart(5)} | ` +
      `${beamScoreStr.padStart(12)} ${beamTimeStr.padStart(8)} | ` +
      `${dpScoreStr.padStart(12)} ${dpTimeStr.padStart(8)} | ${deltaStr}`
    );
  }

  // Summary
  console.log("\n" + "=" .repeat(90));
  console.log("SUMMARY");
  console.log("=" .repeat(90));
  console.log(`Total proteins: ${proteins.length}`);
  console.log(`Beam search: ${beamSuccesses}/${proteins.length} succeeded, ${beamFailures.length} failed`);
  console.log(`DP optimizer: ${dpSuccesses}/${proteins.length} succeeded, ${dpFailures.length} failed`);

  if (beamSuccesses > 0) {
    console.log(`\nBeam search avg score: ${(beamTotalScore / beamSuccesses).toFixed(0)}, total time: ${beamTotalTime}ms`);
  }
  if (dpSuccesses > 0) {
    console.log(`DP optimizer avg score: ${(dpTotalScore / dpSuccesses).toFixed(0)}, total time: ${dpTotalTime}ms`);
  }

  if (beamFailures.length > 0) {
    console.log(`\nBEAM FAILURES:`);
    for (const f of beamFailures) {
      console.log(`  ${f.name} (${f.length} AA): ${f.error}`);
    }
  }

  if (dpFailures.length > 0) {
    console.log(`\nDP FAILURES:`);
    for (const f of dpFailures) {
      console.log(`  ${f.name} (${f.length} AA): ${f.error}`);
    }
  }

  if (beamFailures.length === 0 && dpFailures.length === 0) {
    console.log("\nNo failures from either optimizer!");
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
