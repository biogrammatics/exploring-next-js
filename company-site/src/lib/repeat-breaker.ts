/**
 * Repeat-Breaking Post-Processor for Codon Optimization
 *
 * Takes Twist-flagged repeat regions as input and breaks them via synonymous
 * codon substitutions with minimal scoring penalty.
 *
 * Twist reports repeat pairs as consecutive warning lines:
 *   "Repeat region detected (START - END)"
 * Positions are 1-based on the insert sequence. The first N-1 bases of each
 * pair are an exact match; the Nth base differs. Twist's threshold is ≥14bp
 * exact match.
 *
 * Strategy: For each Twist repeat pair, find the shared exact substring and
 * make a single synonymous codon substitution in either copy to break the
 * match below 14bp.
 *
 * Usage:
 *   const result = breakTwistRepeats(dna, protein, ninemerScores, twistPairs);
 */

import type { NinemerScores } from "./dp-optimizer";

// ─── Genetic Code Constants ─────────────────────────────────────────────────
// Duplicated from dp-optimizer.ts (not exported there)

const GENETIC_CODE: Record<string, string> = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

// Build AA → list of codons mapping
const AA_TO_CODONS: Record<string, string[]> = {};
for (const [codon, aa] of Object.entries(GENETIC_CODE)) {
  if (aa && aa !== "*") {
    if (!AA_TO_CODONS[aa]) AA_TO_CODONS[aa] = [];
    AA_TO_CODONS[aa].push(codon);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** A Twist repeat pair — two regions that share a ≥14bp exact match */
export interface TwistRepeatPair {
  pos1Start: number;     // 0-indexed start of first region in insert DNA
  pos1End: number;       // 0-indexed exclusive end of first region
  pos2Start: number;     // 0-indexed start of second region in insert DNA
  pos2End: number;       // 0-indexed exclusive end of second region
  exactMatchLen: number; // Length of exact match (reported length - 1)
}

/** Log entry for an applied substitution */
export interface SubstitutionLog {
  pairIndex: number;           // Which Twist repeat pair this fixes
  codonIndex: number;          // Amino acid position
  originalCodon: string;
  newCodon: string;
  aminoAcid: string;
  scoreDelta: number;
  inRegion: 1 | 2;            // Which copy of the repeat was modified
}

/** Result of the repeat-breaking post-processor */
export interface RepeatBreakerResult {
  dnaSequence: string;
  originalScore: number;
  newScore: number;
  substitutionsMade: SubstitutionLog[];
  pairsFixed: number;
  pairsRemaining: number;
  totalPairs: number;
  elapsedMs: number;
}

/** Configuration options */
export interface RepeatBreakerOptions {
  maxScorePenaltyPct?: number;   // Max total score loss as %, default: 5.0
  twistExactMatchThreshold?: number; // Twist's minimum exact match length, default: 14
}

// ─── Exclusion Pattern Support ──────────────────────────────────────────────

interface ExclusionPattern {
  regex: RegExp;
  isCodonAligned: boolean;
}

function parseExclusionPatterns(content: string): ExclusionPattern[] {
  const patterns: ExclusionPattern[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.split("#")[0].trim();
    if (!trimmed || trimmed.startsWith(">")) continue;

    let patternStr = trimmed;
    let isCodonAligned = false;
    if (patternStr.endsWith("@codon")) {
      isCodonAligned = true;
      patternStr = patternStr.slice(0, -6).trim();
    }
    try {
      patterns.push({ regex: new RegExp(patternStr, "gi"), isCodonAligned });
    } catch {
      // skip invalid patterns
    }
  }
  return patterns;
}

function violatesExclusionPatterns(
  dna: string,
  patterns: ExclusionPattern[],
  changedCodonIndex: number
): boolean {
  // Check a window around the changed codon
  const changePos = changedCodonIndex * 3;
  const windowStart = Math.max(0, changePos - 100);
  const windowEnd = Math.min(dna.length, changePos + 103);
  const window = dna.slice(windowStart, windowEnd);

  for (const { regex, isCodonAligned } of patterns) {
    regex.lastIndex = 0;
    if (isCodonAligned) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(window)) !== null) {
        if ((windowStart + match.index) % 3 === 0) return true;
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) regex.lastIndex++;
      }
    } else {
      regex.lastIndex = 0;
      if (regex.test(window)) return true;
    }
    regex.lastIndex = 0;
  }
  return false;
}

// ─── Score Computation ──────────────────────────────────────────────────────

function getNinemerScore(
  ninemerScores: NinemerScores,
  aaTriplet: string,
  ninemerDna: string
): number {
  return ninemerScores[aaTriplet]?.[ninemerDna] ?? 0;
}

/**
 * Compute total 9-mer score for a DNA sequence.
 */
export function computeTotalScore(
  dna: string,
  proteinSeq: string,
  ninemerScores: NinemerScores
): number {
  let score = 0;
  const n = proteinSeq.length;
  for (let i = 2; i < n; i++) {
    const aaTriplet = proteinSeq.slice(i - 2, i + 1);
    const ninemer = dna.slice((i - 2) * 3, (i + 1) * 3);
    score += getNinemerScore(ninemerScores, aaTriplet, ninemer);
  }
  return score;
}

/**
 * Compute the score change from substituting a single codon.
 * A codon at AA position `codonIndex` participates in up to 3 overlapping 9-mer windows.
 */
export function computeScoreDelta(
  dna: string,
  proteinSeq: string,
  ninemerScores: NinemerScores,
  codonIndex: number,
  newCodon: string
): number {
  const n = proteinSeq.length;
  let delta = 0;

  // The codon at position codonIndex participates in 9-mer windows starting at
  // positions max(0, codonIndex-2) through min(n-3, codonIndex)
  for (
    let windowStart = Math.max(0, codonIndex - 2);
    windowStart <= Math.min(n - 3, codonIndex);
    windowStart++
  ) {
    const aaTriplet = proteinSeq.slice(windowStart, windowStart + 3);

    // Old 9-mer
    const oldNinemer = dna.slice(windowStart * 3, (windowStart + 3) * 3);
    const oldScore = getNinemerScore(ninemerScores, aaTriplet, oldNinemer);

    // New 9-mer with the substituted codon
    const relativePos = codonIndex - windowStart; // 0, 1, or 2 within the triplet
    const newNinemer =
      oldNinemer.slice(0, relativePos * 3) +
      newCodon +
      oldNinemer.slice((relativePos + 1) * 3);
    const newScore = getNinemerScore(ninemerScores, aaTriplet, newNinemer);

    delta += newScore - oldScore;
  }

  return delta;
}

// ─── Twist Warning Parsing ──────────────────────────────────────────────────

/**
 * Parse Twist warnings into repeat pairs.
 * Twist reports repeats as consecutive pairs of lines:
 *   "Repeat region detected (755 - 774)"
 *   "Repeat region detected (1199 - 1218)"
 * Positions are 1-based on the insert sequence.
 * The first (length-1) bases of each pair are an exact match.
 */
export function parseTwistRepeatPairs(warnings: string): TwistRepeatPair[] {
  const pairs: TwistRepeatPair[] = [];
  const regex = /Repeat region detected \((\d+)\s*-\s*(\d+)\)/g;
  const regions: Array<{ start: number; end: number }> = [];

  let match;
  while ((match = regex.exec(warnings)) !== null) {
    regions.push({
      start: parseInt(match[1]) - 1,  // Convert to 0-indexed
      end: parseInt(match[2]),         // Already exclusive (Twist is 1-based inclusive, -1 + 1 = same)
    });
  }

  // Group into consecutive pairs
  for (let i = 0; i + 1 < regions.length; i += 2) {
    const r1 = regions[i];
    const r2 = regions[i + 1];
    const len1 = r1.end - r1.start;
    const len2 = r2.end - r2.start;

    // Both regions should be the same length (Twist always reports same-length pairs)
    if (len1 !== len2) {
      // If lengths differ, still pair them but use the shorter exact match
      const minLen = Math.min(len1, len2);
      pairs.push({
        pos1Start: r1.start,
        pos1End: r1.start + minLen,
        pos2Start: r2.start,
        pos2End: r2.start + minLen,
        exactMatchLen: minLen - 1, // Last base differs
      });
    } else {
      pairs.push({
        pos1Start: r1.start,
        pos1End: r1.end,
        pos2Start: r2.start,
        pos2End: r2.end,
        exactMatchLen: len1 - 1, // Last base differs
      });
    }
  }

  return pairs;
}

// ─── Repeat Checking ────────────────────────────────────────────────────────

/**
 * Check if a specific Twist repeat pair is still present (exact match ≥ threshold).
 * Returns the length of the longest exact match between the two regions.
 */
function longestExactMatch(dna: string, pair: TwistRepeatPair): number {
  const len = Math.min(
    pair.pos1End - pair.pos1Start,
    pair.pos2End - pair.pos2Start
  );

  // Find the longest run of consecutive matching bases between the two regions
  let maxRun = 0;
  let currentRun = 0;

  for (let i = 0; i < len; i++) {
    if (dna[pair.pos1Start + i] === dna[pair.pos2Start + i]) {
      currentRun++;
      if (currentRun > maxRun) maxRun = currentRun;
    } else {
      currentRun = 0;
    }
  }

  return maxRun;
}

/**
 * Check if a repeat pair is still active (has exact match ≥ threshold).
 */
function isRepeatActive(
  dna: string,
  pair: TwistRepeatPair,
  threshold: number
): boolean {
  return longestExactMatch(dna, pair) >= threshold;
}

// ─── Main Function ──────────────────────────────────────────────────────────

/** Candidate substitution for a single repeat pair */
interface Candidate {
  pairIndex: number;
  codonIndex: number;
  newCodon: string;
  originalCodon: string;
  aminoAcid: string;
  scoreDelta: number;
  inRegion: 1 | 2;
  // How many OTHER active pairs this substitution also fixes (bonus)
  additionalPairsFixed: number;
}

/**
 * Break Twist-flagged repeats in an optimized DNA sequence via synonymous
 * codon substitutions, minimizing the impact on 9-mer expression scores.
 *
 * @param dnaSequence - The optimized DNA (insert only, no adapters)
 * @param proteinSequence - The protein sequence
 * @param ninemerScores - The 9-mer scoring matrix
 * @param twistPairs - Parsed Twist repeat pairs (from parseTwistRepeatPairs)
 * @param exclusionPatterns - Optional exclusion pattern text
 * @param options - Configuration options
 */
export function breakTwistRepeats(
  dnaSequence: string,
  proteinSequence: string,
  ninemerScores: NinemerScores,
  twistPairs: TwistRepeatPair[],
  exclusionPatterns?: string,
  options?: RepeatBreakerOptions
): RepeatBreakerResult {
  const startTime = Date.now();
  const maxPenaltyPct = options?.maxScorePenaltyPct ?? 5.0;
  const threshold = options?.twistExactMatchThreshold ?? 14;

  const patterns = exclusionPatterns
    ? parseExclusionPatterns(exclusionPatterns)
    : [];

  let dna = dnaSequence;
  const originalScore = computeTotalScore(dna, proteinSequence, ninemerScores);
  let currentScore = originalScore;
  const minAllowedScore = originalScore * (1 - maxPenaltyPct / 100);
  const substitutions: SubstitutionLog[] = [];

  // Track which pairs are still active
  const activePairs = new Set<number>();
  for (let i = 0; i < twistPairs.length; i++) {
    const pair = twistPairs[i];
    // Verify pair positions are within bounds
    if (
      pair.pos1Start >= 0 &&
      pair.pos1End <= dna.length &&
      pair.pos2Start >= 0 &&
      pair.pos2End <= dna.length
    ) {
      if (isRepeatActive(dna, pair, threshold)) {
        activePairs.add(i);
      }
    }
  }

  // Process each active pair — try to fix with a single substitution
  // Sort by: pairs with fewer fixable positions first (harder to fix),
  // so we handle constrained ones before easier ones.
  const pairOrder = Array.from(activePairs).sort((a, b) => {
    const pairA = twistPairs[a];
    const pairB = twistPairs[b];
    // Shorter exact matches are harder to break (less room), do them first
    return pairA.exactMatchLen - pairB.exactMatchLen;
  });

  for (const pairIdx of pairOrder) {
    // Skip if already fixed by a previous substitution (side effect)
    if (!isRepeatActive(dna, twistPairs[pairIdx], threshold)) {
      activePairs.delete(pairIdx);
      continue;
    }

    const pair = twistPairs[pairIdx];
    let bestCandidate: Candidate | null = null;

    // Collect codons overlapping EITHER copy of this repeat's exact match region
    // (the exact match is the first N-1 bases, but we should also consider the
    //  Nth base's codon since changing it might extend a mismatch)
    const codonCandidates: Array<{ codonIndex: number; inRegion: 1 | 2 }> = [];

    for (const regionInfo of [
      { start: pair.pos1Start, end: pair.pos1End, region: 1 as const },
      { start: pair.pos2Start, end: pair.pos2End, region: 2 as const },
    ]) {
      const firstCodon = Math.floor(regionInfo.start / 3);
      const lastCodon = Math.floor((regionInfo.end - 1) / 3);
      for (let ci = firstCodon; ci <= lastCodon; ci++) {
        if (ci >= 0 && ci < proteinSequence.length) {
          codonCandidates.push({ codonIndex: ci, inRegion: regionInfo.region });
        }
      }
    }

    // Evaluate each candidate substitution
    for (const { codonIndex, inRegion } of codonCandidates) {
      const currentCodon = dna.slice(codonIndex * 3, codonIndex * 3 + 3);
      const aa = GENETIC_CODE[currentCodon];
      if (!aa || aa === "*") continue;

      const alternatives = AA_TO_CODONS[aa];
      if (!alternatives || alternatives.length <= 1) continue;

      for (const newCodon of alternatives) {
        if (newCodon === currentCodon) continue;

        // Compute score delta
        const delta = computeScoreDelta(
          dna,
          proteinSequence,
          ninemerScores,
          codonIndex,
          newCodon
        );

        // Check score budget
        if (currentScore + delta < minAllowedScore) continue;

        // Simulate substitution
        const tempDna =
          dna.slice(0, codonIndex * 3) +
          newCodon +
          dna.slice(codonIndex * 3 + 3);

        // Check exclusion patterns
        if (
          patterns.length > 0 &&
          violatesExclusionPatterns(tempDna, patterns, codonIndex)
        ) {
          continue;
        }

        // Check if this breaks the current pair
        if (isRepeatActive(tempDna, pair, threshold)) {
          continue; // Didn't fix this pair
        }

        // Count how many other active pairs this also fixes (bonus)
        let additionalFixed = 0;
        for (const otherIdx of activePairs) {
          if (otherIdx === pairIdx) continue;
          if (
            isRepeatActive(dna, twistPairs[otherIdx], threshold) &&
            !isRepeatActive(tempDna, twistPairs[otherIdx], threshold)
          ) {
            additionalFixed++;
          }
        }

        // Rank: most additional pairs fixed first, then smallest score penalty
        if (
          !bestCandidate ||
          additionalFixed > bestCandidate.additionalPairsFixed ||
          (additionalFixed === bestCandidate.additionalPairsFixed &&
            delta > bestCandidate.scoreDelta)
        ) {
          bestCandidate = {
            pairIndex: pairIdx,
            codonIndex,
            newCodon,
            originalCodon: currentCodon,
            aminoAcid: aa,
            scoreDelta: delta,
            inRegion,
            additionalPairsFixed: additionalFixed,
          };
        }
      }
    }

    if (bestCandidate) {
      // Apply the best substitution
      dna =
        dna.slice(0, bestCandidate.codonIndex * 3) +
        bestCandidate.newCodon +
        dna.slice(bestCandidate.codonIndex * 3 + 3);
      currentScore += bestCandidate.scoreDelta;

      substitutions.push({
        pairIndex: pairIdx,
        codonIndex: bestCandidate.codonIndex,
        originalCodon: bestCandidate.originalCodon,
        newCodon: bestCandidate.newCodon,
        aminoAcid: bestCandidate.aminoAcid,
        scoreDelta: bestCandidate.scoreDelta,
        inRegion: bestCandidate.inRegion,
      });

      activePairs.delete(pairIdx);

      // Also remove any other pairs that were incidentally fixed
      for (const otherIdx of Array.from(activePairs)) {
        if (!isRepeatActive(dna, twistPairs[otherIdx], threshold)) {
          activePairs.delete(otherIdx);
        }
      }
    }
    // If no candidate found, this pair remains active (unfixable within budget)
  }

  return {
    dnaSequence: dna,
    originalScore,
    newScore: currentScore,
    substitutionsMade: substitutions,
    pairsFixed: twistPairs.length - activePairs.size,
    pairsRemaining: activePairs.size,
    totalPairs: twistPairs.length,
    elapsedMs: Date.now() - startTime,
  };
}

// ─── CSV Parsing Utilities ──────────────────────────────────────────────────

/** Parsed row from a Twist CSV result */
export interface TwistResult {
  name: string;
  complexity: string;
  warnings: string;
  errors: string;
  insertSequence: string;
}

/** Parse a Twist CSV file into structured results */
export function parseTwistCSV(csvContent: string): TwistResult[] {
  const results: TwistResult[] = [];

  // Handle quoted fields with newlines
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of csvContent) {
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
    if (
      fields.length >
      Math.max(nameIdx, complexityIdx, warningsIdx, errorsIdx)
    ) {
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
