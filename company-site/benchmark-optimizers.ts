import * as fs from 'fs';

// Import both optimizers
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "./src/lib/beam-search-optimizer";

import {
  DPCodonOptimizer,
} from "./src/lib/dp-optimizer";

// Test proteins of various sizes
const PROTEINS = {
  small: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKL", // 42 AA (GFP fragment)
  medium: "MPKPQGSFSPRFAGSRAHRSPARVTGLFAWDPQAVFVSNDMLPANGEQALQSFEKFGELITKLRYLDLRSLMAASSRLTSFTKGVSVLTAVPVPLQQFGIYIPNLRDVSGMIGALLQAKPDGSFFLLNQTGTTGNVQAKALYSGVAQLRFEPVPRQAQDFFGSQNTVNVRAVGDQHLVVLAEGSIPAEFEHFIDTGHPAYFRHNQTASYRQGGGSGFGGLQRVSFKFRSEDAKAVEALNANGVEVFYNPEDVSLAGQLYAMYQHYASSPASMAKAVLQWFKSSNQPYIHFQPVQTQWPYQ", // 300 AA (Nylonase)
  large: "", // Will generate below
};

// Generate a large protein (600 AA) by duplicating nylonase
PROTEINS.large = PROTEINS.medium + PROTEINS.medium;

// Load scores and exclusions
const scoresPath = '/Users/studio/Claude/reverse-translation-optimization/data/ninemer_scores_tripletcounts.json';
const scoresData = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
const ninemerScores: NinemerScores = scoresData.ninemer_scores;

const exclusionsPath = './data/codon-optimization/exclusions.txt';
const exclusionPatterns = fs.readFileSync(exclusionsPath, 'utf-8');

// Also load FASTA format exclusions for DP optimizer
const exclusionsFastaPath = '/tmp/disallowed_full.fa';
const exclusionsFasta = fs.readFileSync(exclusionsFastaPath, 'utf-8');

console.log("=" .repeat(70));
console.log("BENCHMARK: Beam Search vs DP with State Pruning");
console.log("=" .repeat(70));
console.log("");
console.log(`Loaded ${Object.keys(ninemerScores).length} amino acid triplets`);
console.log(`Using 10 exclusion patterns`);
console.log("");

// Create optimizers
const beamOptimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
  beamWidth: 100,
  exclusionPatterns,
  enforceUniqueSixmers: true,
  enforceHomopolymerDiversity: true,
});

const dpOptimizer = new DPCodonOptimizer(ninemerScores, {
  beamWidth: 100,
  pathsPerState: 8,
  exclusionPatterns: exclusionsFasta,
});

// Run benchmarks
const NUM_RUNS = 5;

interface BenchmarkResult {
  name: string;
  size: number;
  beamTimes: number[];
  dpTimes: number[];
  beamScore: number;
  dpScore: number;
  sequenceMatch: boolean;
  codonDiff: number;
}

const results: BenchmarkResult[] = [];

for (const [name, protein] of Object.entries(PROTEINS)) {
  console.log("-".repeat(70));
  console.log(`Testing: ${name} (${protein.length} AA)`);
  console.log("-".repeat(70));

  const beamTimes: number[] = [];
  const dpTimes: number[] = [];
  let beamResult: any = null;
  let dpResult: any = null;

  // Warm up run
  beamOptimizer.optimize(protein);
  dpOptimizer.optimize(protein);

  // Benchmark runs
  for (let i = 0; i < NUM_RUNS; i++) {
    // Beam search
    const beamStart = Date.now();
    beamResult = beamOptimizer.optimize(protein);
    beamTimes.push(Date.now() - beamStart);

    // DP
    const dpStart = Date.now();
    dpResult = dpOptimizer.optimize(protein);
    dpTimes.push(Date.now() - dpStart);
  }

  // Calculate stats
  const avgBeam = beamTimes.reduce((a, b) => a + b, 0) / beamTimes.length;
  const avgDP = dpTimes.reduce((a, b) => a + b, 0) / dpTimes.length;
  const minBeam = Math.min(...beamTimes);
  const minDP = Math.min(...dpTimes);

  console.log("");
  console.log("  Beam Search:");
  console.log(`    Avg time: ${avgBeam.toFixed(1)}ms (min: ${minBeam}ms)`);
  console.log(`    Score: ${beamResult?.score || 'N/A'}`);
  console.log(`    Success: ${beamResult?.success}`);

  console.log("");
  console.log("  DP with State Pruning:");
  console.log(`    Avg time: ${avgDP.toFixed(1)}ms (min: ${minDP}ms)`);
  console.log(`    Score: ${dpResult?.score || 'N/A'}`);
  console.log(`    Success: ${dpResult?.success}`);
  console.log(`    Excluded: ${dpResult?.numExcluded || 0} candidates`);

  // Compare sequences
  let codonDiff = 0;
  if (beamResult?.dnaSequence && dpResult?.dnaSequence) {
    for (let i = 0; i < beamResult.dnaSequence.length; i += 3) {
      if (beamResult.dnaSequence.slice(i, i + 3) !== dpResult.dnaSequence.slice(i, i + 3)) {
        codonDiff++;
      }
    }
  }

  const sequenceMatch = beamResult?.dnaSequence === dpResult?.dnaSequence;

  console.log("");
  console.log("  Comparison:");
  console.log(`    Sequences identical: ${sequenceMatch}`);
  console.log(`    Codon differences: ${codonDiff} / ${protein.length}`);
  console.log(`    Speed ratio (DP/Beam): ${(avgDP / avgBeam).toFixed(2)}x`);

  results.push({
    name,
    size: protein.length,
    beamTimes,
    dpTimes,
    beamScore: beamResult?.score || 0,
    dpScore: dpResult?.score || 0,
    sequenceMatch,
    codonDiff,
  });
}

// Summary table
console.log("");
console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log("");
console.log("| Protein | Size | Beam Avg | DP Avg  | Ratio | Score Diff | Codon Diff |");
console.log("|---------|------|----------|---------|-------|------------|------------|");

for (const r of results) {
  const avgBeam = r.beamTimes.reduce((a, b) => a + b, 0) / r.beamTimes.length;
  const avgDP = r.dpTimes.reduce((a, b) => a + b, 0) / r.dpTimes.length;
  const ratio = avgDP / avgBeam;
  const scoreDiff = r.dpScore - r.beamScore;

  console.log(
    `| ${r.name.padEnd(7)} | ${r.size.toString().padStart(4)} | ` +
    `${avgBeam.toFixed(0).padStart(6)}ms | ${avgDP.toFixed(0).padStart(5)}ms | ` +
    `${ratio.toFixed(2).padStart(5)}x | ${scoreDiff.toString().padStart(10)} | ` +
    `${r.codonDiff.toString().padStart(10)} |`
  );
}

console.log("");

// Analyze codon diversity for the medium protein
console.log("=".repeat(70));
console.log("CODON DIVERSITY ANALYSIS (Nylonase)");
console.log("=".repeat(70));

const nylonase = PROTEINS.medium;
const beamFinal = beamOptimizer.optimize(nylonase);
const dpFinal = dpOptimizer.optimize(nylonase);

function analyzeCodonDiversity(dna: string, protein: string, name: string) {
  const aaCodons: Record<string, string[]> = {};

  for (let i = 0; i < dna.length; i += 3) {
    const codon = dna.slice(i, i + 3);
    const aa = protein[i / 3];
    if (!aaCodons[aa]) aaCodons[aa] = [];
    aaCodons[aa].push(codon);
  }

  let totalUnique = 0;
  let totalPossible = 0;

  for (const [aa, codons] of Object.entries(aaCodons)) {
    if (codons.length > 1) {
      const unique = new Set(codons).size;
      totalUnique += unique;
      totalPossible += 1;
    }
  }

  const avgUnique = totalPossible > 0 ? totalUnique / totalPossible : 0;
  console.log(`  ${name}: ${avgUnique.toFixed(2)} avg unique codons per AA`);
  return avgUnique;
}

console.log("");
if (beamFinal.dnaSequence) {
  analyzeCodonDiversity(beamFinal.dnaSequence, nylonase, "Beam Search");
}
if (dpFinal.dnaSequence) {
  analyzeCodonDiversity(dpFinal.dnaSequence, nylonase, "DP Optimizer");
}

console.log("");
console.log("=".repeat(70));
