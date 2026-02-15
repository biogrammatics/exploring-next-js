/**
 * Re-optimize sequences that Twist flagged for repeat regions.
 *
 * Strategy:
 * 1. Parse Twist CSV output to find flagged sequences and their repeat regions
 * 2. Extract the repeated k-mers from the original DNA
 * 3. Add those k-mers as exclusion patterns
 * 4. Re-run DP optimizer with the expanded exclusion set
 * 5. Verify no flagged repeats remain
 *
 * Run: npx tsx worker/reoptimize-twist-failures.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  DPCodonOptimizer,
  type NinemerScores,
} from "../src/lib/dp-optimizer";
import { enzymeNamesToExclusionPatterns } from "../src/lib/restriction-enzymes";

// --------------- CSV parsing ---------------

interface TwistResult {
  name: string;
  complexity: string;
  warnings: string;
  errors: string;
  insertSequence: string;
}

function parseTwistCSV(csvPath: string): TwistResult[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const results: TwistResult[] = [];

  // Simple CSV parser handling quoted fields
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of content) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);

  // Parse header
  const header = parseCSVLine(lines[0]);
  const nameIdx = header.indexOf("Name");
  const complexityIdx = header.indexOf("Complexity");
  const warningsIdx = header.indexOf("Warnings");
  const errorsIdx = header.indexOf("Errors");
  const insertIdx = header.indexOf("Insert sequence");

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length > Math.max(nameIdx, complexityIdx, warningsIdx, errorsIdx)) {
      results.push({
        name: fields[nameIdx],
        complexity: fields[complexityIdx],
        warnings: fields[warningsIdx] || "",
        errors: fields[errorsIdx] || "",
        insertSequence: fields[insertIdx] || "",
      });
    }
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// --------------- Repeat region extraction ---------------

interface RepeatRegion {
  start: number;
  end: number;
}

function parseRepeatRegions(warnings: string): RepeatRegion[] {
  const regions: RepeatRegion[] = [];
  const regex = /Repeat region detected \((\d+)\s*-\s*(\d+)\)/g;
  let match;
  while ((match = regex.exec(warnings)) !== null) {
    regions.push({
      start: parseInt(match[1]) - 1, // 0-indexed
      end: parseInt(match[2]),        // exclusive end
    });
  }
  return regions;
}

function extractRepeatKmers(dna: string, regions: RepeatRegion[]): string[] {
  const kmers = new Set<string>();
  for (const region of regions) {
    if (region.start >= 0 && region.end <= dna.length) {
      const kmer = dna.slice(region.start, region.end);
      if (kmer.length >= 13) {
        kmers.add(kmer);
      }
    }
  }
  return Array.from(kmers);
}

// --------------- FASTA parsing ---------------

function parseFasta(content: string): Map<string, string> {
  const seqs = new Map<string, string>();
  let name = "";
  let seq: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      if (name && seq.length > 0) {
        seqs.set(name, seq.join(""));
      }
      name = trimmed.slice(1);
      seq = [];
    } else if (trimmed) {
      seq.push(trimmed);
    }
  }
  if (name && seq.length > 0) {
    seqs.set(name, seq.join(""));
  }
  return seqs;
}

function parseFastaProteins(filepath: string): Map<string, string> {
  const content = fs.readFileSync(filepath, "utf-8");
  return parseFasta(content);
}

// --------------- Mapping file ---------------

interface MappingEntry {
  num: string;
  uniprotId: string;
  aaLen: number;
}

function parseMappingFile(filepath: string): Map<string, MappingEntry> {
  const map = new Map<string, MappingEntry>();
  const content = fs.readFileSync(filepath, "utf-8");
  for (const line of content.split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const [num, uniprotId, aaLen] = line.split("\t");
    map.set(`opt${num}`, { num, uniprotId, aaLen: parseInt(aaLen) });
  }
  return map;
}

// --------------- Translate DNA to protein ---------------

const CODON_TABLE: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

function translateDna(dna: string): string {
  const protein: string[] = [];
  for (let i = 0; i + 2 < dna.length; i += 3) {
    const codon = dna.slice(i, i + 3).toUpperCase();
    const aa = CODON_TABLE[codon];
    if (!aa || aa === "*") break;
    protein.push(aa);
  }
  return protein.join("");
}

// --------------- Check for remaining repeats ---------------

function findRepeatedKmers(dna: string, minK: number = 13): Array<{ kmer: string; count: number; positions: number[] }> {
  const results: Array<{ kmer: string; count: number; positions: number[] }> = [];

  for (let k = minK; k <= Math.min(30, dna.length); k++) {
    const kmerPositions = new Map<string, number[]>();
    for (let i = 0; i <= dna.length - k; i++) {
      const kmer = dna.slice(i, i + k);
      if (!kmerPositions.has(kmer)) kmerPositions.set(kmer, []);
      kmerPositions.get(kmer)!.push(i);
    }

    for (const [kmer, positions] of kmerPositions) {
      if (positions.length >= 2) {
        // Only add if not a substring of an already-found longer repeat
        const dominated = results.some(
          (r) => r.kmer.length > kmer.length && r.kmer.includes(kmer)
        );
        if (!dominated) {
          results.push({ kmer, count: positions.length, positions });
        }
      }
    }
  }

  // Sort by length descending
  results.sort((a, b) => b.kmer.length - a.kmer.length);
  return results;
}

// --------------- Main ---------------

async function main() {
  const dataDir = path.join(__dirname, "..", "data", "codon-optimization");

  // Load optimizer
  console.log("Loading 9-mer scoring matrix...");
  const scoresPath = path.join(dataDir, "ninemer_scores.json");
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, "utf-8"));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;

  const exclusionsPath = path.join(dataDir, "exclusions.txt");
  const exclusionPatterns = fs.readFileSync(exclusionsPath, "utf-8");

  const optimizer = new DPCodonOptimizer(ninemerScores, {
    beamWidth: 100,
    pathsPerState: 8,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  // Base restriction enzyme exclusions
  const perJobEnzymes = ["PmeI", "EcoRV", "AleI", "BsaI"];
  const baseEnzymePatterns = enzymeNamesToExclusionPatterns(perJobEnzymes);

  // Load original DNA sequences
  console.log("Loading original sequences...");
  const dnaSeqs100 = parseFasta(
    fs.readFileSync("/Users/tom/Claude/codon-optimization/dp_optimized_100.fasta", "utf-8")
  );
  const dnaSeqs900 = parseFasta(
    fs.readFileSync("/Users/tom/Claude/codon-optimization/dp_optimized_900.fasta", "utf-8")
  );
  const allDnaSeqs = new Map([...dnaSeqs100, ...dnaSeqs900]);

  // Load mapping files
  const mapping100 = parseMappingFile("/Users/tom/Claude/codon-optimization/dp_optimized_100_mapping.tsv");
  const mapping900 = parseMappingFile("/Users/tom/Claude/codon-optimization/dp_optimized_900_mapping.tsv");
  const allMapping = new Map([...mapping100, ...mapping900]);

  // Load Twist results
  console.log("Loading Twist results...");
  const twist100 = parseTwistCSV("/Users/tom/Downloads/100 optimization test.csv");
  const twist900 = parseTwistCSV("/Users/tom/Downloads/100 optimization test (1).csv");
  const allTwist = [...twist100, ...twist900];

  // Filter to sequences that need re-optimization (COMPLEX or NOT ACCEPTED)
  const toReoptimize = allTwist.filter(
    (t) => t.complexity === "COMPLEX" || t.complexity === "NOT ACCEPTED"
  );

  console.log(`\nTotal flagged by Twist: ${toReoptimize.length}`);
  console.log(`  COMPLEX: ${toReoptimize.filter((t) => t.complexity === "COMPLEX").length}`);
  console.log(`  NOT ACCEPTED: ${toReoptimize.filter((t) => t.complexity === "NOT ACCEPTED").length}`);

  // Process each flagged sequence
  const results: Array<{
    name: string;
    originalComplexity: string;
    originalScore: number;
    newScore: number;
    scoreDelta: number;
    repeatsBefore: number;
    repeatsAfter: number;
    longestRepeatBefore: number;
    longestRepeatAfter: number;
    success: boolean;
    error?: string;
    iterations: number;
  }> = [];

  const outputFastaLines: string[] = [];
  const MAX_ITERATIONS = 5;

  console.log("\n" + "=".repeat(90));
  console.log("RE-OPTIMIZING TWIST-FLAGGED SEQUENCES");
  console.log("=".repeat(90));

  for (const twist of toReoptimize) {
    const name = twist.name;
    const originalDna = allDnaSeqs.get(name);
    if (!originalDna) {
      console.log(`  ${name}: SKIP (sequence not found)`);
      continue;
    }

    // Remove TAA stop codon from end for protein extraction
    const dnaNoStop = originalDna.endsWith("TAA")
      ? originalDna.slice(0, -3)
      : originalDna;
    const protein = translateDna(dnaNoStop);

    if (!protein) {
      console.log(`  ${name}: SKIP (translation failed)`);
      continue;
    }

    // Get original score
    const originalRepeats = findRepeatedKmers(dnaNoStop, 13);
    const originalLongest = originalRepeats.length > 0 ? originalRepeats[0].kmer.length : 0;
    const repeatCount = originalRepeats.reduce((sum, r) => sum + r.positions.length - 1, 0);

    console.log(
      `\n  ${name} (${twist.complexity}, ${protein.length} AA, ` +
      `${originalRepeats.length} unique repeats, longest=${originalLongest}bp)`
    );

    // Iterative re-optimization loop
    let currentDna = dnaNoStop;
    let iteration = 0;
    let lastNewDna: string | null = null;
    let accumulatedExclusions = baseEnzymePatterns;

    for (iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      // Find repeated k-mers in current DNA
      const repeats = findRepeatedKmers(currentDna, 13);
      if (repeats.length === 0) {
        console.log(`    Iteration ${iteration}: No more repeats ≥13bp — done!`);
        break;
      }

      // Extract repeat k-mers and add as exclusions
      const repeatKmers = repeats.map((r) => r.kmer);
      const newExclusions = repeatKmers
        .map((k) => `${k}  # Twist repeat (iter ${iteration})`)
        .join("\n");

      accumulatedExclusions = accumulatedExclusions + "\n" + newExclusions;

      console.log(
        `    Iteration ${iteration}: ${repeats.length} repeated k-mers ` +
        `(longest=${repeats[0].kmer.length}bp), adding ${repeatKmers.length} exclusions...`
      );

      // Re-optimize
      const result = optimizer.optimize(protein, accumulatedExclusions);

      if (!result.success) {
        console.log(`    ❌ Optimization failed: ${result.error}`);
        // Try with just the longest repeats
        const topRepeats = repeats.slice(0, Math.min(5, repeats.length));
        const reducedExclusions = baseEnzymePatterns + "\n" +
          topRepeats.map((r) => `${r.kmer}  # Twist repeat`).join("\n");

        const retryResult = optimizer.optimize(protein, reducedExclusions);
        if (retryResult.success && retryResult.dnaSequence) {
          currentDna = retryResult.dnaSequence;
          lastNewDna = currentDna;
          console.log(`    Retry with top ${topRepeats.length} repeats: score=${retryResult.score}`);
        } else {
          console.log(`    ❌ Retry also failed: ${retryResult.error}`);
          break;
        }
      } else if (result.dnaSequence) {
        currentDna = result.dnaSequence;
        lastNewDna = currentDna;

        const newRepeats = findRepeatedKmers(currentDna, 13);
        const newLongest = newRepeats.length > 0 ? newRepeats[0].kmer.length : 0;
        console.log(
          `    → score=${result.score}, repeats=${newRepeats.length}, longest=${newLongest}bp`
        );
      }
    }

    // Final assessment
    const finalDna = lastNewDna || dnaNoStop;
    const finalRepeats = findRepeatedKmers(finalDna, 13);
    const finalLongest = finalRepeats.length > 0 ? finalRepeats[0].kmer.length : 0;
    const finalRepeatCount = finalRepeats.reduce((sum, r) => sum + r.positions.length - 1, 0);

    // Calculate scores by re-running (just for reporting)
    const origResult = optimizer.optimize(protein, baseEnzymePatterns);
    const origScore = origResult.success ? origResult.score! : 0;
    const finalResult = optimizer.optimize(protein, accumulatedExclusions);
    const finalScore = finalResult.success ? finalResult.score! : 0;

    const success = finalRepeats.length === 0 || finalLongest < 13;

    results.push({
      name,
      originalComplexity: twist.complexity,
      originalScore: origScore,
      newScore: finalScore,
      scoreDelta: finalScore - origScore,
      repeatsBefore: originalRepeats.length,
      repeatsAfter: finalRepeats.length,
      longestRepeatBefore: originalLongest,
      longestRepeatAfter: finalLongest,
      success,
      iterations: iteration,
    });

    // Add to output FASTA
    const dnaWithStop = finalDna + "TAA";
    outputFastaLines.push(`>${name}`);
    // Wrap at 80 chars
    for (let i = 0; i < dnaWithStop.length; i += 80) {
      outputFastaLines.push(dnaWithStop.slice(i, i + 80));
    }

    const status = success ? "✅" : finalRepeats.length < originalRepeats.length ? "⚠️" : "❌";
    console.log(
      `  ${status} ${name}: repeats ${originalRepeats.length}→${finalRepeats.length}, ` +
      `longest ${originalLongest}→${finalLongest}bp, ` +
      `score delta ${finalScore - origScore >= 0 ? "+" : ""}${finalScore - origScore}`
    );
  }

  // Write re-optimized FASTA
  const outputPath = "/Users/tom/Claude/codon-optimization/dp_reoptimized_twist.fasta";
  fs.writeFileSync(outputPath, outputFastaLines.join("\n") + "\n");

  // Summary
  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));

  const successes = results.filter((r) => r.success);
  const improved = results.filter((r) => r.repeatsAfter < r.repeatsBefore);
  const unchanged = results.filter((r) => r.repeatsAfter === r.repeatsBefore);

  console.log(`Total re-optimized: ${results.length}`);
  console.log(`  Fully resolved (no 13bp+ repeats): ${successes.length}`);
  console.log(`  Improved but not resolved: ${improved.length - successes.length}`);
  console.log(`  Unchanged: ${unchanged.length}`);

  const avgScoreDelta = results.reduce((s, r) => s + r.scoreDelta, 0) / results.length;
  console.log(`\nAverage score delta: ${avgScoreDelta >= 0 ? "+" : ""}${avgScoreDelta.toFixed(0)}`);

  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
