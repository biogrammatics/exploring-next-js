/**
 * Quick test script for the beam search optimizer
 * Run: npx tsx worker/test-optimizer.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  NinemerBeamSearchOptimizer,
  translateDna,
  type NinemerScores,
} from "../src/lib/beam-search-optimizer";

// Test proteins
const TEST_PROTEINS = [
  { name: "GFP fragment", sequence: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKL" },
  { name: "Short test", sequence: "MHHHHHHENLYFQSM" }, // His-tag + TEV site
  { name: "With homopolymer", sequence: "MAAAAALLLLLKKKKWWW" }, // Poly-A, L, K, W
];

async function main() {
  const dataDir = path.join(__dirname, "..", "data", "codon-optimization");

  // Load scoring matrix
  console.log("Loading 9-mer scoring matrix...");
  const scoresPath = path.join(dataDir, "ninemer_scores.json");
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;
  console.log(`Loaded ${Object.keys(ninemerScores).length} amino acid triplets\n`);

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

  console.log("=" .repeat(70));
  console.log("BEAM SEARCH OPTIMIZER TEST");
  console.log("=" .repeat(70));

  for (const { name, sequence } of TEST_PROTEINS) {
    console.log(`\n${name} (${sequence.length} AA):`);
    console.log(`  Input: ${sequence.slice(0, 40)}${sequence.length > 40 ? "..." : ""}`);

    const result = optimizer.optimize(sequence);

    if (result.success && result.dnaSequence) {
      console.log(`  DNA:   ${result.dnaSequence.slice(0, 60)}${result.dnaSequence.length > 60 ? "..." : ""}`);
      console.log(`  Score: ${result.score?.toLocaleString()} (${(result.score! / sequence.length).toFixed(1)} per AA)`);
      console.log(`  Time:  ${result.elapsedMs}ms`);

      // Verify translation
      const translated = translateDna(result.dnaSequence);
      if (translated === sequence) {
        console.log("  ✓ Translation verified");
      } else {
        console.log(`  ✗ Translation mismatch! Got: ${translated}`);
        process.exit(1);
      }
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
      process.exit(1);
    }
  }

  console.log("\n" + "=" .repeat(70));
  console.log("All tests passed!");
  console.log("=" .repeat(70));
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
