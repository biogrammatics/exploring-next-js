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

/**
 * The 20 standard amino acids. This — plus one optional trailing `*` — is
 * the ONLY thing a protein sequence may contain. Ambiguity codes (B, Z, J,
 * X) and the rare residues U/O are rejected with an explanation rather than
 * silently resolved: substituting a residue changes the protein, and that
 * decision belongs to the customer, not to the optimizer.
 */
export const STANDARD_AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';
const STANDARD_AA_SET = new Set(STANDARD_AMINO_ACIDS);

/** Explanations for characters people commonly paste that are not amino acids. */
const REJECTED_CHAR_REASONS: Record<string, string> = {
  B: 'B is an ambiguity code (Asp or Asn). Replace it with D or N.',
  Z: 'Z is an ambiguity code (Glu or Gln). Replace it with E or Q.',
  J: 'J is an ambiguity code (Leu or Ile). Replace it with L or I.',
  X: 'X means "unknown residue". Replace it with the intended amino acid.',
  U: 'U (selenocysteine) is not supported. Use C if a cysteine is intended.',
  O: 'O (pyrrolysine) is not supported. Use K if a lysine is intended.',
  '*': 'A stop (*) is only allowed as the final character.',
};

/**
 * Safety ceiling on accepted protein length (amino acids). Any real protein
 * fits: the largest known, titin, is about 35,000 aa. The limit exists only
 * to bound CPU and memory for a single job, not to restrict customers.
 */
export const MAX_PROTEIN_LENGTH = 50000;
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
  /** Text of a leading FASTA header line (without ">"), if one was supplied. */
  fastaHeader?: string;
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

  // Accept one leading FASTA header line (">name ...") and drop it.
  let fastaHeader: string | undefined;
  let body = sequence;
  const firstNonBlank = body.search(/\S/);
  if (firstNonBlank !== -1 && body[firstNonBlank] === '>') {
    const lineEnd = body.indexOf('\n', firstNonBlank);
    const headerLine = lineEnd === -1 ? body.slice(firstNonBlank) : body.slice(firstNonBlank, lineEnd);
    fastaHeader = headerLine.slice(1).trim() || undefined;
    body = lineEnd === -1 ? '' : body.slice(lineEnd + 1);
  }

  // Whitespace (spaces, tabs, line breaks) is the only formatting tolerated.
  // Case is normalised. Everything else must be reported, not stripped.
  let cleaned = body.replace(/\s+/g, '').toUpperCase();

  // Exactly one trailing stop codon is allowed; the worker adds its own terminator.
  if (cleaned.endsWith('*')) {
    cleaned = cleaned.slice(0, -1);
  }

  if (cleaned.length === 0) {
    return {
      isValid: false,
      errors: ['No amino acids found. Paste a protein sequence using the 20 standard single-letter codes.'],
      warnings: [],
      cleanedSequence: '',
      length: 0,
      fastaHeader,
    };
  }

  // Report every non-standard character with where it occurs (1-based), grouped
  // by character so a pasted GenBank block with line numbers gives one clear
  // message per offending symbol instead of hundreds of lines.
  const positions = new Map<string, number[]>();
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (!STANDARD_AA_SET.has(ch)) {
      const list = positions.get(ch) ?? [];
      list.push(i + 1);
      positions.set(ch, list);
    }
  }

  const MAX_POSITIONS_SHOWN = 5;
  for (const [ch, pos] of positions) {
    const shown = pos.slice(0, MAX_POSITIONS_SHOWN).join(', ');
    const more = pos.length > MAX_POSITIONS_SHOWN ? ` and ${pos.length - MAX_POSITIONS_SHOWN} more` : '';
    const where = `position${pos.length > 1 ? 's' : ''} ${shown}${more}`;
    let reason = REJECTED_CHAR_REASONS[ch];
    if (!reason) {
      if (/[0-9]/.test(ch)) {
        reason = 'Digits are not amino acids. Remove line numbers or coordinates before pasting.';
      } else if (/[A-Z]/.test(ch)) {
        reason = `"${ch}" is not one of the 20 standard amino acid codes (${STANDARD_AMINO_ACIDS}).`;
      } else {
        reason = `"${ch}" is not an amino acid code. Only the 20 standard letters and an optional final * are accepted.`;
      }
    }
    errors.push(`${reason} Found at ${where}.`);
  }

  if (cleaned.length > MAX_PROTEIN_LENGTH) {
    errors.push(
      `Sequence is too long (${cleaned.length.toLocaleString()} aa). The service accepts up to ${MAX_PROTEIN_LENGTH.toLocaleString()} aa, which covers every known natural protein.`
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
    fastaHeader,
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
