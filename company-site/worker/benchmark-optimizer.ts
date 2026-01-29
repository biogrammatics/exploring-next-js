/**
 * Benchmark script for the TypeScript beam search optimizer
 * Run: npx tsx worker/benchmark-optimizer.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "../src/lib/beam-search-optimizer";

const TEST_PROTEINS = [
  { name: "GFP fragment (42 AA)", sequence: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKL" },
  { name: "Medium (100 AA)", sequence: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITLGMDELYK".slice(0, 100) },
  { name: "Long (500 AA)", sequence: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITLGMDELYK".repeat(3).slice(0, 500) },
];

async function main() {
  const dataDir = path.join(__dirname, "..", "data", "codon-optimization");

  // Load scoring matrix
  const scoresPath = path.join(dataDir, "ninemer_scores.json");
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;

  // Load exclusion patterns
  const exclusionsPath = path.join(dataDir, "exclusions.txt");
  const exclusionPatterns = fs.readFileSync(exclusionsPath, "utf-8");

  // Create optimizer
  const optimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
    beamWidth: 100,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  console.log("TYPESCRIPT BEAM SEARCH OPTIMIZER");
  console.log("=".repeat(60));

  for (const { name, sequence } of TEST_PROTEINS) {
    // Run 3 times and take average
    const times: number[] = [];
    let lastScore = 0;

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const result = optimizer.optimize(sequence);
      const elapsed = Date.now() - start;
      times.push(elapsed);
      if (result.score) lastScore = result.score;
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`${name}: ${avgTime.toFixed(1)}ms (score: ${lastScore.toLocaleString()})`);
  }
}

main().catch(console.error);
