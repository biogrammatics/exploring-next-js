import * as fs from 'fs';

// Import both optimizers
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "./src/lib/beam-search-optimizer";

import {
  DPCodonOptimizer,
} from "./src/lib/dp-optimizer";

// Output file for real-time results
const OUTPUT_FILE = '/Users/studio/Claude/reverse-translation-optimization/analysis_progress.txt';
const RESULTS_JSON = '/Users/studio/Claude/reverse-translation-optimization/analysis_results.json';

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(OUTPUT_FILE, msg + '\n');
}

// Parse FASTA file
function parseFasta(filepath: string): Array<{ header: string; sequence: string }> {
  const content = fs.readFileSync(filepath, 'utf-8');
  const entries: Array<{ header: string; sequence: string }> = [];
  let currentHeader = '';
  let currentSeq = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      if (currentHeader) {
        entries.push({ header: currentHeader, sequence: currentSeq });
      }
      currentHeader = trimmed.slice(1);
      currentSeq = '';
    } else {
      currentSeq += trimmed.replace(/\s/g, '');
    }
  }
  if (currentHeader) {
    entries.push({ header: currentHeader, sequence: currentSeq });
  }
  return entries;
}

// Exclusion patterns for verification
const EXCLUSION_PATTERNS: Array<[string, RegExp]> = [
  ['PmeI', /GTTTAAAC/i],
  ['PolyA', /A{6,}/i],
  ['PolyT', /T{6,}/i],
  ['PolyG', /G{6,}/i],
  ['PolyC', /C{6,}/i],
  ['AT_rich', /[AT]{9,}/i],
  ['GC_rich', /[GC]{9,}/i],
  ['Donor_splice', /GTA[AT]GT/i],
  ['Acceptor_splice', /TAAC[ACGT]{1,19}[TC]AG/i],
  ['KpnI_repeat', /(GGTACC){2,}/i],
];

// Check if DNA passes all exclusion patterns
function checkExclusions(dna: string): { pass: boolean; failed: string[] } {
  const failed: string[] = [];
  for (const [name, regex] of EXCLUSION_PATTERNS) {
    if (regex.test(dna)) {
      failed.push(name);
    }
  }
  return { pass: failed.length === 0, failed };
}

// Analyze codon diversity
function analyzeCodonDiversity(dna: string, protein: string): {
  avgUnique: number;
  singleCodonAAs: string[];
} {
  const aaCodons: Record<string, string[]> = {};

  for (let i = 0; i < dna.length; i += 3) {
    const codon = dna.slice(i, i + 3);
    const aa = protein[i / 3];
    if (!aaCodons[aa]) aaCodons[aa] = [];
    aaCodons[aa].push(codon);
  }

  let totalUnique = 0;
  let totalPossible = 0;
  const singleCodonAAs: string[] = [];
  const singleCodonOnly = new Set(['M', 'W']);

  for (const [aa, codons] of Object.entries(aaCodons)) {
    const unique = new Set(codons).size;

    if (codons.length > 1 && !singleCodonOnly.has(aa)) {
      totalUnique += unique;
      totalPossible += 1;
      if (unique === 1) {
        singleCodonAAs.push(aa);
      }
    }
  }

  const avgUnique = totalPossible > 0 ? totalUnique / totalPossible : 0;
  return { avgUnique, singleCodonAAs };
}

// Calculate CAI-like expression score
const CODON_WEIGHTS: Record<string, number> = {
  'TTT': 0.6, 'TTC': 1.0, 'TTA': 0.3, 'TTG': 1.0,
  'TCT': 1.0, 'TCC': 0.7, 'TCA': 0.5, 'TCG': 0.2,
  'TAT': 0.5, 'TAC': 1.0, 'TGT': 0.6, 'TGC': 1.0, 'TGG': 1.0,
  'CTT': 0.4, 'CTC': 0.3, 'CTA': 0.2, 'CTG': 0.5,
  'CCT': 0.6, 'CCC': 0.4, 'CCA': 1.0, 'CCG': 0.2,
  'CAT': 0.5, 'CAC': 1.0, 'CAA': 1.0, 'CAG': 0.4,
  'CGT': 0.3, 'CGC': 0.2, 'CGA': 0.2, 'CGG': 0.1,
  'ATT': 1.0, 'ATC': 0.8, 'ATA': 0.3, 'ATG': 1.0,
  'ACT': 1.0, 'ACC': 0.7, 'ACA': 0.5, 'ACG': 0.2,
  'AAT': 0.5, 'AAC': 1.0, 'AAA': 0.5, 'AAG': 1.0,
  'AGT': 0.4, 'AGC': 0.6, 'AGA': 1.0, 'AGG': 0.3,
  'GTT': 1.0, 'GTC': 0.7, 'GTA': 0.3, 'GTG': 0.5,
  'GCT': 1.0, 'GCC': 0.6, 'GCA': 0.5, 'GCG': 0.2,
  'GAT': 0.6, 'GAC': 1.0, 'GAA': 1.0, 'GAG': 0.5,
  'GGT': 1.0, 'GGC': 0.4, 'GGA': 0.5, 'GGG': 0.2,
};

function calculateCAI(dna: string): number {
  let logSum = 0;
  let count = 0;

  for (let i = 0; i < dna.length; i += 3) {
    const codon = dna.slice(i, i + 3).toUpperCase();
    const weight = CODON_WEIGHTS[codon];
    if (weight && weight > 0) {
      logSum += Math.log(weight);
      count++;
    }
  }

  return count > 0 ? Math.exp(logSum / count) : 0;
}

// Result interface
interface ProteinResult {
  header: string;
  length: number;
  beam: {
    success: boolean;
    time: number;
    score: number;
    exclusionPass: boolean;
    failedPatterns: string[];
    avgDiversity: number;
    singleCodonAAs: string[];
    cai: number;
  };
  dp: {
    success: boolean;
    time: number;
    score: number;
    exclusionPass: boolean;
    failedPatterns: string[];
    avgDiversity: number;
    singleCodonAAs: string[];
    cai: number;
  };
}

// Main analysis
async function main() {
  // Clear output file
  fs.writeFileSync(OUTPUT_FILE, '');

  const fastaPath = '/Users/studio/Claude/reverse-translation-optimization/human283.fa';
  const proteins = parseFasta(fastaPath);

  log("=".repeat(80));
  log("COMPREHENSIVE PROTEIN ANALYSIS: Beam Search vs DP Optimizer");
  log("=".repeat(80));
  log(`Started: ${new Date().toISOString()}`);
  log(`Analyzing ${proteins.length} proteins from human283.fa`);
  log(`Results file: ${OUTPUT_FILE}`);
  log("");

  // Load scores and exclusions
  const scoresPath = '/Users/studio/Claude/reverse-translation-optimization/data/ninemer_scores_tripletcounts.json';
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;

  const exclusionsPath = '/Users/studio/Claude/exploring-next-js/company-site/data/codon-optimization/exclusions.txt';
  const exclusionPatterns = fs.readFileSync(exclusionsPath, 'utf-8');
  const exclusionsFasta = fs.readFileSync('/tmp/disallowed_full.fa', 'utf-8');

  log(`Loaded ${Object.keys(ninemerScores).length} amino acid triplets`);
  log(`Using 10 exclusion patterns`);
  log("");

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

  const results: ProteinResult[] = [];

  // Running totals for live stats
  let beamSuccessCount = 0;
  let dpSuccessCount = 0;
  let beamExclusionPassCount = 0;
  let dpExclusionPassCount = 0;
  let totalBeamTime = 0;
  let totalDPTime = 0;

  log("-".repeat(80));
  log("PROCESSING PROTEINS");
  log("-".repeat(80));

  for (let i = 0; i < proteins.length; i++) {
    const { header, sequence } = proteins[i];

    const result: ProteinResult = {
      header,
      length: sequence.length,
      beam: {
        success: false, time: 0, score: 0, exclusionPass: false,
        failedPatterns: [], avgDiversity: 0, singleCodonAAs: [], cai: 0
      },
      dp: {
        success: false, time: 0, score: 0, exclusionPass: false,
        failedPatterns: [], avgDiversity: 0, singleCodonAAs: [], cai: 0
      },
    };

    // Run Beam Search
    try {
      const startBeam = Date.now();
      const beamResult = beamOptimizer.optimize(sequence);
      result.beam.time = Date.now() - startBeam;
      totalBeamTime += result.beam.time;

      if (beamResult.success && beamResult.dnaSequence) {
        result.beam.success = true;
        result.beam.score = beamResult.score || 0;
        beamSuccessCount++;

        const exclusionCheck = checkExclusions(beamResult.dnaSequence);
        result.beam.exclusionPass = exclusionCheck.pass;
        result.beam.failedPatterns = exclusionCheck.failed;
        if (exclusionCheck.pass) beamExclusionPassCount++;

        const diversity = analyzeCodonDiversity(beamResult.dnaSequence, sequence);
        result.beam.avgDiversity = diversity.avgUnique;
        result.beam.singleCodonAAs = diversity.singleCodonAAs;
        result.beam.cai = calculateCAI(beamResult.dnaSequence);
      }
    } catch (e) {
      result.beam.success = false;
    }

    // Run DP Optimizer
    try {
      const startDP = Date.now();
      const dpResult = dpOptimizer.optimize(sequence);
      result.dp.time = Date.now() - startDP;
      totalDPTime += result.dp.time;

      if (dpResult.success && dpResult.dnaSequence) {
        result.dp.success = true;
        result.dp.score = dpResult.score || 0;
        dpSuccessCount++;

        const exclusionCheck = checkExclusions(dpResult.dnaSequence);
        result.dp.exclusionPass = exclusionCheck.pass;
        result.dp.failedPatterns = exclusionCheck.failed;
        if (exclusionCheck.pass) dpExclusionPassCount++;

        const diversity = analyzeCodonDiversity(dpResult.dnaSequence, sequence);
        result.dp.avgDiversity = diversity.avgUnique;
        result.dp.singleCodonAAs = diversity.singleCodonAAs;
        result.dp.cai = calculateCAI(dpResult.dnaSequence);
      }
    } catch (e) {
      result.dp.success = false;
    }

    results.push(result);

    // Log progress every 10 proteins or on failure
    const beamStatus = result.beam.success ? (result.beam.exclusionPass ? "OK" : "EXCL_FAIL") : "FAILURE";
    const dpStatus = result.dp.success ? (result.dp.exclusionPass ? "OK" : "EXCL_FAIL") : "FAILURE";

    if ((i + 1) % 10 === 0 || !result.beam.success || !result.dp.success ||
        !result.beam.exclusionPass || !result.dp.exclusionPass) {
      log(`[${(i+1).toString().padStart(3)}/${proteins.length}] ${header.substring(0, 20).padEnd(20)} (${sequence.length.toString().padStart(4)} AA) | Beam: ${beamStatus.padEnd(9)} ${result.beam.time}ms | DP: ${dpStatus.padEnd(9)} ${result.dp.time}ms`);
    }

    // Save intermediate results every 50 proteins
    if ((i + 1) % 50 === 0) {
      const intermediateData = {
        processed: i + 1,
        total: proteins.length,
        beamSuccesses: beamSuccessCount,
        dpSuccesses: dpSuccessCount,
        beamExclusionPass: beamExclusionPassCount,
        dpExclusionPass: dpExclusionPassCount,
        totalBeamTime,
        totalDPTime,
      };
      fs.writeFileSync(RESULTS_JSON, JSON.stringify({ intermediate: intermediateData, results }, null, 2));
    }
  }

  // Final summary
  log("");
  log("=".repeat(80));
  log("FINAL SUMMARY");
  log("=".repeat(80));

  const beamSuccesses = results.filter(r => r.beam.success);
  const dpSuccesses = results.filter(r => r.dp.success);

  log("");
  log("--- SUCCESS RATES ---");
  log(`Beam Search: ${beamSuccessCount}/${results.length} succeeded (${(beamSuccessCount/results.length*100).toFixed(1)}%)`);
  log(`DP Optimizer: ${dpSuccessCount}/${results.length} succeeded (${(dpSuccessCount/results.length*100).toFixed(1)}%)`);

  log("");
  log("--- EXCLUSION PATTERN COMPLIANCE ---");
  log(`Beam Search: ${beamExclusionPassCount}/${beamSuccessCount} pass all patterns (${(beamExclusionPassCount/beamSuccessCount*100).toFixed(1)}%)`);
  log(`DP Optimizer: ${dpExclusionPassCount}/${dpSuccessCount} pass all patterns (${(dpExclusionPassCount/dpSuccessCount*100).toFixed(1)}%)`);

  // Exclusion failures detail
  const beamExclusionFails = results.filter(r => r.beam.success && !r.beam.exclusionPass);
  const dpExclusionFails = results.filter(r => r.dp.success && !r.dp.exclusionPass);

  if (beamExclusionFails.length > 0) {
    log(`\nBeam Search exclusion failures (${beamExclusionFails.length}):`);
    for (const r of beamExclusionFails) {
      log(`  ${r.header}: ${r.beam.failedPatterns.join(', ')}`);
    }
  }

  if (dpExclusionFails.length > 0) {
    log(`\nDP Optimizer exclusion failures (${dpExclusionFails.length}):`);
    for (const r of dpExclusionFails) {
      log(`  ${r.header}: ${r.dp.failedPatterns.join(', ')}`);
    }
  }

  // Timing
  const avgBeamTime = totalBeamTime / beamSuccessCount;
  const avgDPTime = totalDPTime / dpSuccessCount;

  log("");
  log("--- TIMING ---");
  log(`Beam Search: avg ${avgBeamTime.toFixed(1)}ms, total ${(totalBeamTime/1000).toFixed(1)}s`);
  log(`DP Optimizer: avg ${avgDPTime.toFixed(1)}ms, total ${(totalDPTime/1000).toFixed(1)}s`);
  log(`Speed ratio (DP/Beam): ${(avgDPTime/avgBeamTime).toFixed(2)}x`);

  // Diversity
  const beamDiversity = beamSuccesses.map(r => r.beam.avgDiversity);
  const dpDiversity = dpSuccesses.map(r => r.dp.avgDiversity);
  const avgBeamDiversity = beamDiversity.reduce((a, b) => a + b, 0) / beamDiversity.length;
  const avgDPDiversity = dpDiversity.reduce((a, b) => a + b, 0) / dpDiversity.length;

  log("");
  log("--- CODON DIVERSITY ---");
  log(`Beam Search: ${avgBeamDiversity.toFixed(2)} avg unique codons per AA`);
  log(`DP Optimizer: ${avgDPDiversity.toFixed(2)} avg unique codons per AA`);

  // Single codon AAs
  const beamSingleCodonCounts: Record<string, number> = {};
  const dpSingleCodonCounts: Record<string, number> = {};

  for (const r of beamSuccesses) {
    for (const aa of r.beam.singleCodonAAs) {
      beamSingleCodonCounts[aa] = (beamSingleCodonCounts[aa] || 0) + 1;
    }
  }
  for (const r of dpSuccesses) {
    for (const aa of r.dp.singleCodonAAs) {
      dpSingleCodonCounts[aa] = (dpSingleCodonCounts[aa] || 0) + 1;
    }
  }

  log("");
  log("--- AMINO ACIDS WITH 100% SINGLE CODON USAGE ---");
  log("(Count = proteins where this AA uses only one codon)");

  log("\nBeam Search:");
  const beamSorted = Object.entries(beamSingleCodonCounts).sort((a, b) => b[1] - a[1]);
  if (beamSorted.length === 0) {
    log("  None - all AAs use multiple codons!");
  } else {
    for (const [aa, count] of beamSorted) {
      log(`  ${aa}: ${count} proteins (${(count/beamSuccessCount*100).toFixed(1)}%)`);
    }
  }

  log("\nDP Optimizer:");
  const dpSorted = Object.entries(dpSingleCodonCounts).sort((a, b) => b[1] - a[1]);
  if (dpSorted.length === 0) {
    log("  None - all AAs use multiple codons!");
  } else {
    for (const [aa, count] of dpSorted) {
      log(`  ${aa}: ${count} proteins (${(count/dpSuccessCount*100).toFixed(1)}%)`);
    }
  }

  // CAI
  const beamCAIs = beamSuccesses.map(r => r.beam.cai);
  const dpCAIs = dpSuccesses.map(r => r.dp.cai);
  const avgBeamCAI = beamCAIs.reduce((a, b) => a + b, 0) / beamCAIs.length;
  const avgDPCAI = dpCAIs.reduce((a, b) => a + b, 0) / dpCAIs.length;

  log("");
  log("--- CAI EXPRESSION SCORE ---");
  log(`Beam Search: ${avgBeamCAI.toFixed(4)} average CAI`);
  log(`DP Optimizer: ${avgDPCAI.toFixed(4)} average CAI`);

  // Score comparison
  const bothSuccess = results.filter(r => r.beam.success && r.dp.success);
  let dpWins = 0, beamWins = 0, ties = 0;

  for (const r of bothSuccess) {
    if (r.dp.score > r.beam.score) dpWins++;
    else if (r.beam.score > r.dp.score) beamWins++;
    else ties++;
  }

  log("");
  log("--- OPTIMIZATION SCORE COMPARISON ---");
  log(`(For ${bothSuccess.length} proteins where both succeeded)`);
  log(`DP wins: ${dpWins} (${(dpWins/bothSuccess.length*100).toFixed(1)}%)`);
  log(`Beam wins: ${beamWins} (${(beamWins/bothSuccess.length*100).toFixed(1)}%)`);
  log(`Ties: ${ties} (${(ties/bothSuccess.length*100).toFixed(1)}%)`);

  // Failures
  const beamFailures = results.filter(r => !r.beam.success);
  const dpFailures = results.filter(r => !r.dp.success);

  if (beamFailures.length > 0) {
    log(`\n--- BEAM SEARCH FAILURES (${beamFailures.length}) ---`);
    for (const r of beamFailures) {
      log(`  ${r.header} (${r.length} AA)`);
    }
  }

  if (dpFailures.length > 0) {
    log(`\n--- DP OPTIMIZER FAILURES (${dpFailures.length}) ---`);
    for (const r of dpFailures) {
      log(`  ${r.header} (${r.length} AA)`);
    }
  }

  // Size stats
  const sizes = results.map(r => r.length);
  log("");
  log("--- PROTEIN SIZE DISTRIBUTION ---");
  log(`Min: ${Math.min(...sizes)} AA, Max: ${Math.max(...sizes)} AA, Avg: ${(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(0)} AA`);

  log("");
  log("=".repeat(80));
  log(`Completed: ${new Date().toISOString()}`);

  // Save final results
  const finalData = {
    summary: {
      totalProteins: results.length,
      beamSuccesses: beamSuccessCount,
      dpSuccesses: dpSuccessCount,
      beamExclusionPass: beamExclusionPassCount,
      dpExclusionPass: dpExclusionPassCount,
      avgBeamTime,
      avgDPTime,
      avgBeamDiversity,
      avgDPDiversity,
      avgBeamCAI,
      avgDPCAI,
      dpWins,
      beamWins,
      ties,
    },
    results,
  };

  fs.writeFileSync(RESULTS_JSON, JSON.stringify(finalData, null, 2));
  log(`\nResults saved to: ${RESULTS_JSON}`);
}

main().catch(console.error);
