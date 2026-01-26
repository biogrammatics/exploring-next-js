/**
 * Beam Search Codon Optimizer
 *
 * TypeScript port of the Python beam_search_ninemer_optimizer.py
 * Uses 9-mer frequencies from Pichia pastoris transcriptome data
 * for optimal codon selection via beam search.
 */

// Genetic code mapping
const GENETIC_CODE: Record<string, string> = {
  'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
  'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
  'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
  'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
  'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
  'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
  'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
  'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
  'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
  'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
  'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
};

// Build reverse mapping: amino acid -> codons
const AA_TO_CODONS: Record<string, string[]> = {};
for (const [codon, aa] of Object.entries(GENETIC_CODE)) {
  if (aa !== '*') {
    if (!AA_TO_CODONS[aa]) {
      AA_TO_CODONS[aa] = [];
    }
    AA_TO_CODONS[aa].push(codon);
  }
}

/**
 * Translate DNA sequence to protein
 */
export function translateDna(dnaSeq: string): string {
  const protein: string[] = [];
  for (let i = 0; i < dnaSeq.length; i += 3) {
    if (i + 3 <= dnaSeq.length) {
      const codon = dnaSeq.slice(i, i + 3);
      const aa = GENETIC_CODE[codon] || '?';
      if (aa === '*') break;
      protein.push(aa);
    }
  }
  return protein.join('');
}

/**
 * Constraint checker for homopolymeric amino acid runs.
 * Ensures runs of 4+ identical AAs don't have 4+ identical codons.
 */
class HomopolymerDiversityConstraint {
  private runs: Array<{ start: number; length: number; aa: string }> = [];

  constructor(proteinSeq: string, minLength = 4) {
    let i = 0;
    while (i < proteinSeq.length) {
      const aa = proteinSeq[i];
      const runStart = i;
      let runLength = 1;

      while (i + 1 < proteinSeq.length && proteinSeq[i + 1] === aa) {
        runLength++;
        i++;
      }

      // Record if run is long enough (skip M and W - single codon AAs)
      if (runLength >= minLength && aa !== 'M' && aa !== 'W') {
        this.runs.push({ start: runStart, length: runLength, aa });
      }
      i++;
    }
  }

  hasRuns(): boolean {
    return this.runs.length > 0;
  }

  isValidIncremental(dnaSequence: string, currentAaPos: number): boolean {
    const dnaLen = dnaSequence.length;

    for (const { start, length } of this.runs) {
      if (!(start <= currentAaPos && currentAaPos < start + length)) {
        continue;
      }

      const dnaStart = start * 3;
      const codons: string[] = [];

      for (let i = 0; i < length; i++) {
        const codonPos = dnaStart + i * 3;
        if (codonPos + 3 > dnaLen) break;
        const codon = dnaSequence.slice(codonPos, codonPos + 3);
        if (codon.length === 3) {
          codons.push(codon);
        }
      }

      if (codons.length < 4) continue;

      // Check for 4+ consecutive identical codons
      let consecutiveCount = 1;
      for (let i = 1; i < codons.length; i++) {
        if (codons[i] === codons[i - 1]) {
          consecutiveCount++;
          if (consecutiveCount >= 4) return false;
        } else {
          consecutiveCount = 1;
        }
      }
    }
    return true;
  }
}

/**
 * Constraint checker for repeated 6-mer amino acid sequences.
 * Ensures repeated 6-mers are encoded with different DNA sequences.
 */
class RepeatedSixmerConstraint {
  private constraints: Map<number, number[]> = new Map();

  constructor(proteinSeq: string) {
    // Find all 6-mer positions
    const sixmerPositions: Map<string, number[]> = new Map();
    for (let i = 0; i <= proteinSeq.length - 6; i++) {
      const sixmer = proteinSeq.slice(i, i + 6);
      if (!sixmerPositions.has(sixmer)) {
        sixmerPositions.set(sixmer, []);
      }
      sixmerPositions.get(sixmer)!.push(i);
    }

    // For repeated 6-mers, record constraints
    sixmerPositions.forEach((positions, sixmer) => {
      if (positions.length > 1) {
        // Skip 6-mers that are only M and/or W
        if (Array.from(sixmer).every(aa => aa === 'M' || aa === 'W')) {
          return;
        }

        for (const pos of positions) {
          const dnaStart = pos * 3;
          const otherPositions = positions.filter(p => p !== pos).map(p => p * 3);
          this.constraints.set(dnaStart, otherPositions);
        }
      }
    });
  }

  hasRepeats(): boolean {
    return this.constraints.size > 0;
  }

  isValidIncremental(dnaSequence: string, currentAaPos: number): boolean {
    const dnaLen = dnaSequence.length;
    const sixmerStartAa = currentAaPos - 5;
    if (sixmerStartAa < 0) return true;

    const sixmerStartDna = sixmerStartAa * 3;
    const avoidPositions = this.constraints.get(sixmerStartDna);
    if (!avoidPositions) return true;

    const current18mer = dnaSequence.slice(sixmerStartDna, sixmerStartDna + 18);
    if (current18mer.length < 18) return true;

    for (const avoidPos of avoidPositions) {
      if (avoidPos + 18 <= dnaLen) {
        const avoid18mer = dnaSequence.slice(avoidPos, avoidPos + 18);
        if (avoid18mer.length === 18 && current18mer === avoid18mer) {
          return false;
        }
      }
    }
    return true;
  }
}

/**
 * Exclusion pattern with optional codon alignment requirement
 */
interface ExclusionPattern {
  original: string;
  regex: RegExp;
  isCodonAligned: boolean;
}

/**
 * Parse exclusion patterns from text content
 */
function parseExclusionPatterns(content: string): ExclusionPattern[] {
  const patterns: ExclusionPattern[] = [];

  for (const line of content.split('\n')) {
    // Remove comments and whitespace
    const trimmed = line.split('#')[0].trim();
    if (!trimmed) continue;

    let patternStr = trimmed;
    let isCodonAligned = false;

    if (patternStr.endsWith('@codon')) {
      isCodonAligned = true;
      patternStr = patternStr.slice(0, -6).trim();
    }

    try {
      patterns.push({
        original: trimmed,
        regex: new RegExp(patternStr, 'gi'),
        isCodonAligned
      });
    } catch (e) {
      console.warn(`Invalid regex pattern: ${patternStr}`, e);
    }
  }

  return patterns;
}

/**
 * Check if DNA sequence contains any excluded pattern
 */
function containsExcludedPattern(
  dnaSeq: string,
  patterns: ExclusionPattern[],
  maxPatternLength = 100
): boolean {
  const dnaLen = dnaSeq.length;
  const windowStart = Math.max(0, dnaLen - maxPatternLength);
  const window = dnaSeq.slice(windowStart);

  for (const { regex, isCodonAligned } of patterns) {
    regex.lastIndex = 0; // Reset regex state

    if (isCodonAligned) {
      let match;
      while ((match = regex.exec(window)) !== null) {
        const matchPosInFull = windowStart + match.index;
        if (matchPosInFull % 3 === 0) {
          return true;
        }
      }
    } else {
      if (regex.test(window)) {
        return true;
      }
    }
    regex.lastIndex = 0;
  }
  return false;
}

// Type for 9-mer scores
export type NinemerScores = Record<string, Record<string, number>>;

export interface OptimizationResult {
  success: boolean;
  dnaSequence?: string;
  score?: number;
  elapsedMs?: number;
  error?: string;
}

export interface OptimizerOptions {
  beamWidth?: number;
  exclusionPatterns?: string;
  enforceUniqueSixmers?: boolean;
  enforceHomopolymerDiversity?: boolean;
}

/**
 * Beam search optimizer using 9-mer frequencies
 */
export class NinemerBeamSearchOptimizer {
  private ninemerScores: NinemerScores;
  private beamWidth: number;
  private exclusionPatterns: ExclusionPattern[];
  private enforceUniqueSixmers: boolean;
  private enforceHomopolymerDiversity: boolean;

  constructor(ninemerScores: NinemerScores, options: OptimizerOptions = {}) {
    this.ninemerScores = ninemerScores;
    this.beamWidth = options.beamWidth ?? 100;
    this.exclusionPatterns = options.exclusionPatterns
      ? parseExclusionPatterns(options.exclusionPatterns)
      : [];
    this.enforceUniqueSixmers = options.enforceUniqueSixmers ?? true;
    this.enforceHomopolymerDiversity = options.enforceHomopolymerDiversity ?? true;
  }

  private getNinemerScore(aaTriplet: string, ninemerDna: string): number {
    const tripletScores = this.ninemerScores[aaTriplet];
    if (!tripletScores) return 0;
    return tripletScores[ninemerDna] ?? 0;
  }

  /**
   * Optimize a protein sequence to DNA using beam search
   */
  optimize(proteinSeq: string): OptimizationResult {
    const startTime = Date.now();
    const n = proteinSeq.length;

    // Validate protein sequence
    for (const aa of proteinSeq) {
      if (!AA_TO_CODONS[aa]) {
        return {
          success: false,
          error: `Invalid amino acid: ${aa}`
        };
      }
    }

    // Set up constraints
    const sixmerConstraint = this.enforceUniqueSixmers
      ? new RepeatedSixmerConstraint(proteinSeq)
      : null;

    const homopolymerConstraint = this.enforceHomopolymerDiversity
      ? new HomopolymerDiversityConstraint(proteinSeq)
      : null;

    // Initialize beam: [score, dnaString]
    let beam: Array<[number, string]> = [[0, '']];

    // Build sequence one codon at a time
    for (let pos = 0; pos < n; pos++) {
      const aa = proteinSeq[pos];
      const possibleCodons = AA_TO_CODONS[aa];
      const newBeam: Array<[number, string]> = [];

      for (const [score, dnaString] of beam) {
        for (const codon of possibleCodons) {
          const newDna = dnaString + codon;
          let newScore = score;

          // Check exclusion patterns
          if (this.exclusionPatterns.length > 0) {
            if (containsExcludedPattern(newDna, this.exclusionPatterns)) {
              continue;
            }
          }

          // Check repeated 6-mer constraint
          if (sixmerConstraint?.hasRepeats()) {
            if (!sixmerConstraint.isValidIncremental(newDna, pos)) {
              continue;
            }
          }

          // Check homopolymer diversity constraint
          if (homopolymerConstraint?.hasRuns()) {
            if (!homopolymerConstraint.isValidIncremental(newDna, pos)) {
              continue;
            }
          }

          // Score 9-mer when we have 3 consecutive codons
          if (pos >= 2) {
            const aaTriplet = proteinSeq.slice(pos - 2, pos + 1);
            const ninemerDna = newDna.slice((pos - 2) * 3, (pos + 1) * 3);
            newScore += this.getNinemerScore(aaTriplet, ninemerDna);
          }

          newBeam.push([newScore, newDna]);
        }
      }

      // Keep top K candidates
      newBeam.sort((a, b) => b[0] - a[0]);
      beam = newBeam.slice(0, this.beamWidth);

      // If beam is empty, all candidates were excluded
      if (beam.length === 0) {
        return {
          success: false,
          error: `All candidates excluded at position ${pos + 1}/${n}. Exclusion patterns may be too restrictive.`
        };
      }
    }

    const [bestScore, bestDna] = beam[0];
    const elapsedMs = Date.now() - startTime;

    // Verify translation
    const translated = translateDna(bestDna);
    if (translated !== proteinSeq) {
      return {
        success: false,
        error: `Translation verification failed. Expected ${proteinSeq.length} AA, got ${translated.length}`
      };
    }

    return {
      success: true,
      dnaSequence: bestDna,
      score: bestScore,
      elapsedMs
    };
  }
}
