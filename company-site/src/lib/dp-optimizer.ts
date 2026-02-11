/**
 * Dynamic Programming Codon Optimizer with State Pruning
 *
 * TypeScript port of the Ruby protein_optimization_incremental.rb
 * Uses DP with state-based pruning for better path diversity.
 *
 * Key difference from beam search:
 * - Groups candidates by "state" (last 2 codons)
 * - Keeps multiple paths per state for diversity
 * - Then prunes to top K states overall
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

// All 64 codons in order (for index-based lookup)
const CODONS = [
  'TTT', 'TTC', 'TTA', 'TTG', 'TCT', 'TCC', 'TCA', 'TCG',
  'TAT', 'TAC', 'TAA', 'TAG', 'TGT', 'TGC', 'TGA', 'TGG',
  'CTT', 'CTC', 'CTA', 'CTG', 'CCT', 'CCC', 'CCA', 'CCG',
  'CAT', 'CAC', 'CAA', 'CAG', 'CGT', 'CGC', 'CGA', 'CGG',
  'ATT', 'ATC', 'ATA', 'ATG', 'ACT', 'ACC', 'ACA', 'ACG',
  'AAT', 'AAC', 'AAA', 'AAG', 'AGT', 'AGC', 'AGA', 'AGG',
  'GTT', 'GTC', 'GTA', 'GTG', 'GCT', 'GCC', 'GCA', 'GCG',
  'GAT', 'GAC', 'GAA', 'GAG', 'GGT', 'GGC', 'GGA', 'GGG'
];

// Build codon to index mapping
const CODON_TO_IDX: Record<string, number> = {};
CODONS.forEach((codon, idx) => {
  CODON_TO_IDX[codon] = idx;
});

// Build amino acid to codon indices mapping
const AA_TO_CODON_INDICES: Record<string, number[]> = {};
CODONS.forEach((codon, idx) => {
  const aa = GENETIC_CODE[codon];
  if (aa && aa !== '*') {
    if (!AA_TO_CODON_INDICES[aa]) {
      AA_TO_CODON_INDICES[aa] = [];
    }
    AA_TO_CODON_INDICES[aa].push(idx);
  }
});

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
 * Exclusion pattern interface
 */
interface ExclusionPattern {
  name: string;
  pattern: string;
  regex: RegExp;
}

/**
 * Parse exclusion patterns from FASTA-like format
 */
function parseExclusionPatterns(content: string): ExclusionPattern[] {
  const patterns: ExclusionPattern[] = [];
  const lines = content.split('\n');
  let currentName = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('>')) {
      currentName = trimmed.slice(1);
    } else if (currentName) {
      try {
        patterns.push({
          name: currentName,
          pattern: trimmed,
          regex: new RegExp(trimmed, 'i')
        });
      } catch (e) {
        console.warn(`Invalid regex pattern: ${trimmed}`, e);
      }
      currentName = '';
    } else {
      // Line-based format (one pattern per line)
      const commentIdx = trimmed.indexOf('#');
      const patternStr = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trim() : trimmed;
      if (patternStr) {
        try {
          patterns.push({
            name: patternStr,
            pattern: patternStr,
            regex: new RegExp(patternStr, 'i')
          });
        } catch (e) {
          console.warn(`Invalid regex pattern: ${patternStr}`, e);
        }
      }
    }
  }

  return patterns;
}

// Type for 9-mer scores (same as beam search)
export type NinemerScores = Record<string, Record<string, number>>;

export interface DPOptimizationResult {
  success: boolean;
  dnaSequence?: string;
  score?: number;
  elapsedMs?: number;
  numExcluded?: number;
  error?: string;
}

export interface DPOptimizerOptions {
  beamWidth?: number;
  pathsPerState?: number;
  exclusionPatterns?: string;
  maxPatternLength?: number;
}

/**
 * State in the DP search
 */
interface DPState {
  score: number;
  dna: string;
  lastTwoIndices: [number, number]; // Last two codon indices for state key
}

/**
 * DP optimizer using state-based pruning
 */
export class DPCodonOptimizer {
  private ninemerScores: NinemerScores;
  private beamWidth: number;
  private pathsPerState: number;
  private exclusionPatterns: ExclusionPattern[];
  private maxPatternLength: number;

  constructor(ninemerScores: NinemerScores, options: DPOptimizerOptions = {}) {
    this.ninemerScores = ninemerScores;
    this.beamWidth = options.beamWidth ?? 100;
    this.pathsPerState = options.pathsPerState ?? 8;
    this.exclusionPatterns = options.exclusionPatterns
      ? parseExclusionPatterns(options.exclusionPatterns)
      : [];
    this.maxPatternLength = options.maxPatternLength ?? 100;
  }

  /**
   * Get 9-mer score for a triplet
   */
  private getNinemerScore(aaTriplet: string, ninemerDna: string): number {
    const tripletScores = this.ninemerScores[aaTriplet];
    if (!tripletScores) return 0;
    return tripletScores[ninemerDna] ?? 0;
  }

  /**
   * Check if DNA sequence contains any excluded pattern (incremental)
   */
  private containsExcludedPatternIncremental(dna: string): boolean {
    if (this.exclusionPatterns.length === 0) return false;

    const windowStart = Math.max(0, dna.length - this.maxPatternLength);
    const window = dna.slice(windowStart);

    for (const { regex } of this.exclusionPatterns) {
      regex.lastIndex = 0;
      if (regex.test(window)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create state key from last two codon indices
   */
  private makeStateKey(idx1: number, idx2: number): number {
    return (idx1 << 6) | idx2;
  }

  /**
   * Optimize a protein sequence to DNA using DP with state pruning
   */
  optimize(proteinSeq: string): DPOptimizationResult {
    const startTime = Date.now();
    const n = proteinSeq.length;

    // Validate protein sequence
    for (const aa of proteinSeq) {
      if (!AA_TO_CODON_INDICES[aa]) {
        return {
          success: false,
          error: `Invalid amino acid: ${aa}`
        };
      }
    }

    if (n < 2) {
      return {
        success: false,
        error: 'Protein sequence must be at least 2 amino acids'
      };
    }

    let numExcluded = 0;

    // Initialize with first two positions
    const aa0 = proteinSeq[0];
    const aa1 = proteinSeq[1];

    // State groups: Map<stateKey, DPState[]>
    let stateGroups = new Map<number, DPState[]>();

    for (const c0 of AA_TO_CODON_INDICES[aa0]) {
      for (const c1 of AA_TO_CODON_INDICES[aa1]) {
        const dna = CODONS[c0] + CODONS[c1];

        // Check exclusion patterns
        if (this.containsExcludedPatternIncremental(dna)) {
          numExcluded++;
          continue;
        }

        const stateKey = this.makeStateKey(c0, c1);
        const state: DPState = {
          score: 0,
          dna,
          lastTwoIndices: [c0, c1]
        };

        if (!stateGroups.has(stateKey)) {
          stateGroups.set(stateKey, []);
        }
        stateGroups.get(stateKey)!.push(state);
      }
    }

    // Process positions 2 to n-1
    for (let pos = 2; pos < n; pos++) {
      const aa = proteinSeq[pos];
      const possibleCodonIndices = AA_TO_CODON_INDICES[aa];
      const newStateGroups = new Map<number, DPState[]>();

      for (const [, states] of stateGroups) {
        for (const state of states) {
          const [prevPrev, prev] = state.lastTwoIndices;

          for (const curr of possibleCodonIndices) {
            const codon = CODONS[curr];
            const newDna = state.dna + codon;

            // Check exclusion patterns (incremental)
            if (this.containsExcludedPatternIncremental(newDna)) {
              numExcluded++;
              continue;
            }

            // Score the 9-mer
            const aaTriplet = proteinSeq.slice(pos - 2, pos + 1);
            const ninemerDna = CODONS[prevPrev] + CODONS[prev] + codon;
            const ninemerScore = this.getNinemerScore(aaTriplet, ninemerDna);
            const newScore = state.score + ninemerScore;

            const newStateKey = this.makeStateKey(prev, curr);
            const newState: DPState = {
              score: newScore,
              dna: newDna,
              lastTwoIndices: [prev, curr]
            };

            if (!newStateGroups.has(newStateKey)) {
              newStateGroups.set(newStateKey, []);
            }
            newStateGroups.get(newStateKey)!.push(newState);
          }
        }
      }

      // Prune: keep top pathsPerState paths per state
      for (const [key, states] of newStateGroups) {
        states.sort((a, b) => b.score - a.score);
        newStateGroups.set(key, states.slice(0, this.pathsPerState));
      }

      // Prune: keep top beamWidth states overall
      if (newStateGroups.size > this.beamWidth) {
        // Get best score per state
        const stateScores: Array<[number, number]> = [];
        for (const [key, states] of newStateGroups) {
          stateScores.push([key, states[0].score]);
        }
        stateScores.sort((a, b) => b[1] - a[1]);

        const keepKeys = new Set(stateScores.slice(0, this.beamWidth).map(x => x[0]));
        const prunedGroups = new Map<number, DPState[]>();
        for (const [key, states] of newStateGroups) {
          if (keepKeys.has(key)) {
            prunedGroups.set(key, states);
          }
        }
        stateGroups = prunedGroups;
      } else {
        stateGroups = newStateGroups;
      }

      // Check if all candidates were excluded
      if (stateGroups.size === 0) {
        return {
          success: false,
          error: `All candidates excluded at position ${pos + 1}/${n}. Exclusion patterns may be too restrictive.`
        };
      }
    }

    // Extract best solution
    let bestState: DPState | null = null;
    for (const states of stateGroups.values()) {
      for (const state of states) {
        if (!bestState || state.score > bestState.score) {
          bestState = state;
        }
      }
    }

    if (!bestState) {
      return {
        success: false,
        error: 'No valid solution found'
      };
    }

    const elapsedMs = Date.now() - startTime;

    // Verify translation
    const translated = translateDna(bestState.dna);
    if (translated !== proteinSeq) {
      return {
        success: false,
        error: `Translation verification failed. Expected ${proteinSeq.length} AA, got ${translated.length}`
      };
    }

    return {
      success: true,
      dnaSequence: bestState.dna,
      score: bestState.score,
      elapsedMs,
      numExcluded
    };
  }
}
