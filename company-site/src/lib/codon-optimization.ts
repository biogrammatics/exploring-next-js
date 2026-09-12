/**
 * Codon Optimization Library
 *
 * Provides reverse translation from protein (amino acid) sequences to DNA sequences
 * using codon usage tables for different organisms.
 *
 * Currently implements random codon selection from valid codons for each amino acid.
 * This can be replaced with more sophisticated algorithms (CAI optimization, etc.)
 */

// Standard genetic code: amino acid -> list of codons
const CODON_TABLE: Record<string, string[]> = {
  // Nonpolar (hydrophobic)
  'A': ['GCT', 'GCC', 'GCA', 'GCG'],           // Alanine
  'V': ['GTT', 'GTC', 'GTA', 'GTG'],           // Valine
  'L': ['TTA', 'TTG', 'CTT', 'CTC', 'CTA', 'CTG'], // Leucine
  'I': ['ATT', 'ATC', 'ATA'],                   // Isoleucine
  'M': ['ATG'],                                  // Methionine (Start)
  'F': ['TTT', 'TTC'],                          // Phenylalanine
  'W': ['TGG'],                                  // Tryptophan
  'P': ['CCT', 'CCC', 'CCA', 'CCG'],           // Proline

  // Polar (uncharged)
  'S': ['TCT', 'TCC', 'TCA', 'TCG', 'AGT', 'AGC'], // Serine
  'T': ['ACT', 'ACC', 'ACA', 'ACG'],           // Threonine
  'N': ['AAT', 'AAC'],                          // Asparagine
  'Q': ['CAA', 'CAG'],                          // Glutamine
  'Y': ['TAT', 'TAC'],                          // Tyrosine
  'C': ['TGT', 'TGC'],                          // Cysteine
  'G': ['GGT', 'GGC', 'GGA', 'GGG'],           // Glycine

  // Positively charged (basic)
  'K': ['AAA', 'AAG'],                          // Lysine
  'R': ['CGT', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'], // Arginine
  'H': ['CAT', 'CAC'],                          // Histidine

  // Negatively charged (acidic)
  'D': ['GAT', 'GAC'],                          // Aspartic acid
  'E': ['GAA', 'GAG'],                          // Glutamic acid

  // Stop codons (represented as *)
  '*': ['TAA', 'TAG', 'TGA'],                   // Stop
};

// Valid single-letter amino acid codes
const VALID_AMINO_ACIDS = new Set(Object.keys(CODON_TABLE));

// Additional valid characters in protein sequences
const VALID_SEQUENCE_CHARS = new Set([
  ...VALID_AMINO_ACIDS,
  'X',  // Unknown amino acid
  'B',  // Aspartic acid or Asparagine (D or N)
  'Z',  // Glutamic acid or Glutamine (E or Q)
  'J',  // Leucine or Isoleucine (L or I)
  'U',  // Selenocysteine (rare, treat as C)
  'O',  // Pyrrolysine (rare, treat as K)
]);

/** Hard upper bound on accepted protein length (amino acids). Longer input is rejected. */
export const MAX_PROTEIN_LENGTH = 10000;
/** Above this length we accept the sequence but warn that processing will be slow. */
export const LONG_PROTEIN_WARNING_LENGTH = 5000;

/**
 * Exclusion-pattern validator for user-supplied restriction-site patterns.
 *
 * Patterns are compiled into a RegExp by the worker's optimizers and stored
 * comma-joined, so we allow only a non-backtracking subset: IUPAC nucleotide
 * codes, character classes `[...]`, and bounded quantifiers `{n}` (`{n,m}` is
 * excluded because the comma is the storage separator). Alternation, unbounded
 * repetition, anchors, wildcards, escapes, and commas are rejected. This keeps
 * e.g. `CAC[ACGT]{4}GTG` (AleI) working.
 */
export const MAX_EXCLUSION_PATTERN_LENGTH = 64;
export const MAX_EXCLUSION_PATTERNS = 50;
const EXCLUSION_PATTERN_ALPHABET = /^[ACGTURYKMSWBDHVNacgturykmswbdhvn\[\]{}0-9]+$/;

export type ExclusionPatternCheck = { ok: true } | { ok: false; reason: string };

export function validateExclusionPattern(pattern: unknown): ExclusionPatternCheck {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return { ok: false, reason: 'Pattern must be a non-empty string' };
  }
  if (pattern.length > MAX_EXCLUSION_PATTERN_LENGTH) {
    return {
      ok: false,
      reason: `Pattern exceeds ${MAX_EXCLUSION_PATTERN_LENGTH} characters`,
    };
  }
  if (pattern.includes(',')) {
    return { ok: false, reason: 'Pattern must not contain a comma' };
  }
  if (!EXCLUSION_PATTERN_ALPHABET.test(pattern)) {
    return {
      ok: false,
      reason:
        'Pattern may only contain IUPAC nucleotide codes, character classes [..] and bounded quantifiers {n}; regex operators ( ) + * ? | . ^ $ \\ are not allowed',
    };
  }
  // Structural check: brackets/braces must be balanced, non-nested, and a
  // brace group must be a bounded quantifier {n} following a base or
  // character class.
  let depthSq = 0;
  let inBrace = false;
  let braceBody = '';
  let prevWasAtom = false;
  for (const ch of pattern) {
    if (inBrace) {
      if (ch === '}') {
        if (!/^\d+$/.test(braceBody)) {
          return { ok: false, reason: `Malformed quantifier {${braceBody}}` };
        }
        inBrace = false;
        braceBody = '';
        prevWasAtom = false;
        continue;
      }
      braceBody += ch;
      continue;
    }
    if (depthSq > 0) {
      if (ch === '[') return { ok: false, reason: 'Nested character class' };
      if (ch === ']') {
        depthSq = 0;
        prevWasAtom = true;
        continue;
      }
      if (ch === '{' || ch === '}' || /\d/.test(ch)) {
        return { ok: false, reason: 'Character class may only contain nucleotide codes' };
      }
      continue;
    }
    if (ch === '[') {
      depthSq = 1;
      continue;
    }
    if (ch === ']' || ch === '}') {
      return { ok: false, reason: `Unbalanced '${ch}'` };
    }
    if (ch === '{') {
      if (!prevWasAtom) return { ok: false, reason: 'Quantifier must follow a base or character class' };
      inBrace = true;
      continue;
    }
    if (/\d/.test(ch)) {
      return { ok: false, reason: 'Digits are only allowed inside a {n} quantifier' };
    }
    prevWasAtom = true;
  }
  if (depthSq > 0 || inBrace) {
    return { ok: false, reason: 'Unbalanced bracket or brace' };
  }
  try {
    new RegExp(pattern);
  } catch {
    return { ok: false, reason: 'Pattern is not a valid expression' };
  }
  return { ok: true };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedSequence: string;
  length: number;
}

export interface OptimizationResult {
  success: boolean;
  dnaSequence?: string;
  proteinSequence: string;
  errors: string[];
  stats?: {
    aminoAcidCount: number;
    dnaLength: number;
    gcContent: number;
  };
}

/**
 * Validate a protein sequence
 * - Removes whitespace and numbers
 * - Converts to uppercase
 * - Strips exactly one trailing `*` (conventional terminator)
 * - Rejects internal stop codons, invalid characters, and over-long input
 */
export function validateProteinSequence(sequence: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Remove whitespace, numbers, and common formatting
  let cleaned = sequence
    .toUpperCase()
    .replace(/[\s\d\-\.]/g, '')
    .replace(/[^A-Z*]/g, '');

  // Strip exactly one trailing stop codon; the worker adds its own terminator.
  if (cleaned.endsWith('*')) {
    cleaned = cleaned.slice(0, -1);
  }

  if (cleaned.length === 0) {
    return {
      isValid: false,
      errors: ['Sequence is empty after cleaning'],
      warnings: [],
      cleanedSequence: '',
      length: 0,
    };
  }

  // Check for invalid characters
  const invalidChars = new Set<string>();
  for (const char of cleaned) {
    if (!VALID_SEQUENCE_CHARS.has(char)) {
      invalidChars.add(char);
    }
  }

  if (invalidChars.size > 0) {
    errors.push(`Invalid amino acid characters: ${Array.from(invalidChars).join(', ')}`);
  }

  // Check for ambiguous amino acids and warn
  const ambiguousChars: string[] = [];
  for (const char of cleaned) {
    if (['X', 'B', 'Z', 'J', 'U', 'O'].includes(char)) {
      ambiguousChars.push(char);
    }
  }

  if (ambiguousChars.length > 0) {
    warnings.push(`Sequence contains ambiguous amino acids that will be resolved: ${[...new Set(ambiguousChars)].join(', ')}`);
  }

  // Any remaining `*` is an internal stop codon (the trailing one was stripped above)
  const internalStop = cleaned.indexOf('*');
  if (internalStop !== -1) {
    errors.push(`Internal stop codon at position ${internalStop + 1}`);
  }

  // Check sequence length
  if (cleaned.length > MAX_PROTEIN_LENGTH) {
    errors.push(
      `Sequence is too long (${cleaned.length} aa). Maximum is ${MAX_PROTEIN_LENGTH.toLocaleString()} aa.`
    );
  } else if (cleaned.length > LONG_PROTEIN_WARNING_LENGTH) {
    warnings.push(
      `Sequence is very long (>${LONG_PROTEIN_WARNING_LENGTH.toLocaleString()} aa). Processing may take longer.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cleanedSequence: cleaned,
    length: cleaned.length,
  };
}

/**
 * Resolve ambiguous amino acids to standard ones
 */
function resolveAmbiguousAminoAcid(aa: string): string {
  switch (aa) {
    case 'B': return Math.random() < 0.5 ? 'D' : 'N';  // Aspartic acid or Asparagine
    case 'Z': return Math.random() < 0.5 ? 'E' : 'Q';  // Glutamic acid or Glutamine
    case 'J': return Math.random() < 0.5 ? 'L' : 'I';  // Leucine or Isoleucine
    case 'U': return 'C';  // Selenocysteine -> Cysteine
    case 'O': return 'K';  // Pyrrolysine -> Lysine
    case 'X': {
      // Random standard amino acid (excluding stop)
      const standardAAs = 'ACDEFGHIKLMNPQRSTVWY';
      return standardAAs[Math.floor(Math.random() * standardAAs.length)];
    }
    default: return aa;
  }
}

/**
 * Select a random codon for an amino acid
 * This is the simplest approach - can be replaced with:
 * - Codon Adaptation Index (CAI) optimization
 * - Organism-specific codon usage tables
 * - GC content optimization
 */
function selectCodon(aminoAcid: string, _organism: string = 'pichia'): string {
  // Resolve ambiguous amino acids first
  const resolvedAA = resolveAmbiguousAminoAcid(aminoAcid);

  const codons = CODON_TABLE[resolvedAA];
  if (!codons || codons.length === 0) {
    throw new Error(`No codons found for amino acid: ${aminoAcid}`);
  }

  // Random selection (to be replaced with organism-specific optimization)
  // TODO: Use organism-specific codon usage tables for weighted selection
  return codons[Math.floor(Math.random() * codons.length)];
}

/**
 * Calculate GC content of a DNA sequence
 */
function calculateGCContent(dnaSequence: string): number {
  const gcCount = (dnaSequence.match(/[GC]/gi) || []).length;
  return (gcCount / dnaSequence.length) * 100;
}

/**
 * Perform codon optimization (reverse translation)
 * Converts a protein sequence to a DNA sequence
 */
export function optimizeCodon(
  proteinSequence: string,
  organism: string = 'pichia'
): OptimizationResult {
  // Validate the sequence first
  const validation = validateProteinSequence(proteinSequence);

  if (!validation.isValid) {
    return {
      success: false,
      proteinSequence: validation.cleanedSequence,
      errors: validation.errors,
    };
  }

  const cleanedSequence = validation.cleanedSequence;
  const errors: string[] = [];
  const codons: string[] = [];

  try {
    for (const aa of cleanedSequence) {
      const codon = selectCodon(aa, organism);
      codons.push(codon);
    }

    const dnaSequence = codons.join('');

    return {
      success: true,
      dnaSequence,
      proteinSequence: cleanedSequence,
      errors: validation.warnings, // Include warnings as informational
      stats: {
        aminoAcidCount: cleanedSequence.length,
        dnaLength: dnaSequence.length,
        gcContent: Math.round(calculateGCContent(dnaSequence) * 100) / 100,
      },
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during optimization');
    return {
      success: false,
      proteinSequence: cleanedSequence,
      errors,
    };
  }
}

/**
 * Format DNA sequence with line breaks for display
 */
export function formatDNASequence(sequence: string, lineLength: number = 60): string {
  const lines: string[] = [];
  for (let i = 0; i < sequence.length; i += lineLength) {
    lines.push(sequence.slice(i, i + lineLength));
  }
  return lines.join('\n');
}

/**
 * Format protein sequence with line breaks for display
 */
export function formatProteinSequence(sequence: string, lineLength: number = 60): string {
  const lines: string[] = [];
  for (let i = 0; i < sequence.length; i += lineLength) {
    lines.push(sequence.slice(i, i + lineLength));
  }
  return lines.join('\n');
}
