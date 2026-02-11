import * as fs from 'fs';

// Import the beam search optimizer
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "./src/lib/beam-search-optimizer";

// Nylonase protein sequence
const nylonase = "MPKPQGSFSPRFAGSRAHRSPARVTGLFAWDPQAVFVSNDMLPANGEQALQSFEKFGELITKLRYLDLRSLMAASSRLTSFTKGVSVLTAVPVPLQQFGIYIPNLRDVSGMIGALLQAKPDGSFFLLNQTGTTGNVQAKALYSGVAQLRFEPVPRQAQDFFGSQNTVNVRAVGDQHLVVLAEGSIPAEFEHFIDTGHPAYFRHNQTASYRQGGGSGFGGLQRVSFKFRSEDAKAVEALNANGVEVFYNPEDVSLAGQLYAMYQHYASSPASMAKAVLQWFKSSNQPYIHFQPVQTQWPYQ";

// Load tripletcounts.txt-based scores
const scoresPath = '/Users/studio/Claude/reverse-translation-optimization/data/ninemer_scores_tripletcounts.json';
const scoresData = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
const ninemerScores: NinemerScores = scoresData.ninemer_scores;

console.log("Loaded " + Object.keys(ninemerScores).length + " amino acid triplets from tripletcounts.txt");

// Load exclusion patterns
const exclusionsPath = './data/codon-optimization/exclusions.txt';
const exclusionPatterns = fs.readFileSync(exclusionsPath, 'utf-8');

// Create optimizer
const optimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
  beamWidth: 100,
  exclusionPatterns,
  enforceUniqueSixmers: true,
  enforceHomopolymerDiversity: true,
});

console.log("Running TypeScript beam search with tripletcounts.txt table...");
console.log("======================================================================");

const result = optimizer.optimize(nylonase);

if (result.success && result.dnaSequence) {
  console.log("");
  console.log("TypeScript (tripletcounts.txt) DNA length: " + result.dnaSequence.length);
  console.log("Score: " + result.score);
  console.log("Time: " + result.elapsedMs + "ms");

  // Analyze codon diversity
  const codons: string[] = [];
  for (let i = 0; i < result.dnaSequence.length; i += 3) {
    codons.push(result.dnaSequence.slice(i, i + 3));
  }

  // Group by amino acid
  const aaCodons: Record<string, string[]> = {};
  for (let i = 0; i < codons.length; i++) {
    const aa = nylonase[i];
    if (!aaCodons[aa]) aaCodons[aa] = [];
    aaCodons[aa].push(codons[i]);
  }

  console.log("");
  console.log("TypeScript Beam Search (tripletcounts.txt)");
  console.log("============================================================");

  let totalUnique = 0;
  let totalPossible = 0;

  const sortedAAs = Object.keys(aaCodons).sort();
  for (const aa of sortedAAs) {
    const codonList = aaCodons[aa];
    const counts: Record<string, number> = {};
    for (const c of codonList) {
      counts[c] = (counts[c] || 0) + 1;
    }
    const uniqueCodons = Object.keys(counts).length;
    const totalOccurrences = codonList.length;

    if (totalOccurrences > 1) {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const usageStr = sorted.map(function(entry) { return entry[0] + ":" + entry[1]; }).join(", ");
      const padded = totalOccurrences.toString().padStart(2);
      console.log("  " + aa + " (" + padded + "x): " + uniqueCodons + " unique - " + usageStr);
      totalUnique += uniqueCodons;
      totalPossible += 1;
    }
  }

  const avgUnique = totalPossible > 0 ? totalUnique / totalPossible : 0;
  console.log("");
  console.log("Average unique codons per AA: " + avgUnique.toFixed(2));

  console.log("");
  console.log("");
  console.log("TypeScript (tripletcounts.txt) DNA:");
  console.log(result.dnaSequence);
} else {
  console.error("Optimization failed:", result.error);
}
