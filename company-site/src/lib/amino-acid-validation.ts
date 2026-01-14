/**
 * Amino Acid Sequence Validation Utilities
 *
 * Ported from Rails concern: app/models/concerns/amino_acid_sequence_validation.rb
 *
 * Provides utilities for validating and processing amino acid sequences
 * for protein expression projects.
 */

// Valid single-letter amino acid codes (IUPAC standard) plus stop codon
export const AMINO_ACIDS = [
  "A", // Alanine
  "R", // Arginine
  "N", // Asparagine
  "D", // Aspartic acid
  "C", // Cysteine
  "E", // Glutamic acid
  "Q", // Glutamine
  "G", // Glycine
  "H", // Histidine
  "I", // Isoleucine
  "L", // Leucine
  "K", // Lysine
  "M", // Methionine
  "F", // Phenylalanine
  "P", // Proline
  "S", // Serine
  "T", // Threonine
  "W", // Tryptophan
  "Y", // Tyrosine
  "V", // Valine
  "*", // Stop codon
] as const;

export type AminoAcid = (typeof AMINO_ACIDS)[number];

// Average molecular weight of an amino acid in Daltons
const AVERAGE_AA_WEIGHT_DA = 110;

export interface ValidationOptions {
  requireMethionine?: boolean;
  requireStopCodon?: boolean;
  minimumLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  cleanedSequence: string;
  stats?: SequenceStats;
}

export interface SequenceStats {
  length: number;
  startsWithMethionine: boolean;
  endsWithStopCodon: boolean;
  estimatedMolecularWeight: number;
}

/**
 * Clean and normalize an amino acid sequence.
 * Removes whitespace and converts to uppercase.
 */
export function cleanSequence(sequence: string | null | undefined): string {
  if (!sequence) return "";
  return sequence.replace(/\s+/g, "").toUpperCase();
}

/**
 * Get the length of a cleaned sequence.
 */
export function getSequenceLength(sequence: string | null | undefined): number {
  return cleanSequence(sequence).length;
}

/**
 * Check if a sequence starts with methionine (M).
 */
export function startsWithMethionine(
  sequence: string | null | undefined
): boolean {
  const cleaned = cleanSequence(sequence);
  return cleaned.length > 0 && cleaned.startsWith("M");
}

/**
 * Check if a sequence ends with a stop codon (*).
 */
export function endsWithStopCodon(
  sequence: string | null | undefined
): boolean {
  const cleaned = cleanSequence(sequence);
  return cleaned.length > 0 && cleaned.endsWith("*");
}

/**
 * Estimate the molecular weight of a protein in Daltons.
 * Uses average amino acid weight of ~110 Da.
 */
export function estimateMolecularWeight(
  sequence: string | null | undefined
): number | null {
  const length = getSequenceLength(sequence);
  if (length === 0) return null;
  return Math.round(length * AVERAGE_AA_WEIGHT_DA);
}

/**
 * Format molecular weight for display (e.g., "12.5 kDa").
 */
export function formatMolecularWeight(weightDa: number | null): string {
  if (weightDa === null) return "N/A";
  if (weightDa >= 1000) {
    return `${(weightDa / 1000).toFixed(1)} kDa`;
  }
  return `${weightDa} Da`;
}

/**
 * Find invalid characters in an amino acid sequence.
 */
export function findInvalidCharacters(
  sequence: string | null | undefined
): string[] {
  const cleaned = cleanSequence(sequence);
  if (!cleaned) return [];

  const uniqueChars = [...new Set(cleaned.split(""))];
  const aminoAcidSet = new Set<string>(AMINO_ACIDS);

  return uniqueChars.filter((char) => !aminoAcidSet.has(char));
}

/**
 * Validate an amino acid sequence with configurable options.
 */
export function validateSequence(
  sequence: string | null | undefined,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const cleaned = cleanSequence(sequence);

  const {
    requireMethionine = false,
    requireStopCodon = false,
    minimumLength = 2,
  } = options;

  // Check if sequence is empty
  if (!cleaned) {
    return {
      valid: false,
      errors: ["Sequence is empty"],
      cleanedSequence: "",
    };
  }

  // Check for invalid amino acid codes
  const invalidChars = findInvalidCharacters(cleaned);
  if (invalidChars.length > 0) {
    errors.push(
      `Contains invalid amino acid codes: ${invalidChars.join(", ")}`
    );
  }

  // Check if sequence starts with methionine (if required)
  if (requireMethionine && !cleaned.startsWith("M")) {
    errors.push("Must start with methionine (M)");
  }

  // Check if sequence ends with stop codon (if required)
  if (requireStopCodon && !cleaned.endsWith("*")) {
    errors.push("Must end with stop codon (*)");
  }

  // Check minimum length
  if (cleaned.length < minimumLength) {
    if (requireMethionine && requireStopCodon) {
      errors.push(
        `Must be at least ${minimumLength} amino acids long (M....*)`
      );
    } else {
      errors.push(`Must be at least ${minimumLength} amino acids long`);
    }
  }

  // Calculate stats
  const stats: SequenceStats = {
    length: cleaned.length,
    startsWithMethionine: startsWithMethionine(cleaned),
    endsWithStopCodon: endsWithStopCodon(cleaned),
    estimatedMolecularWeight: estimateMolecularWeight(cleaned) ?? 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    cleanedSequence: cleaned,
    stats,
  };
}

/**
 * Ensure a sequence has proper start (M) and end (*) characters.
 * Optionally adds them if missing.
 */
export function normalizeSequence(
  sequence: string | null | undefined,
  addMethionine = true,
  addStopCodon = true
): string {
  let cleaned = cleanSequence(sequence);

  if (!cleaned) return "";

  // Add methionine at start if missing
  if (addMethionine && !cleaned.startsWith("M")) {
    cleaned = "M" + cleaned;
  }

  // Add stop codon at end if missing
  if (addStopCodon && !cleaned.endsWith("*")) {
    cleaned = cleaned + "*";
  }

  return cleaned;
}

/**
 * Calculate the amino acid composition of a sequence.
 * Returns a map of amino acid codes to their counts.
 */
export function calculateComposition(
  sequence: string | null | undefined
): Map<string, number> {
  const cleaned = cleanSequence(sequence);
  const composition = new Map<string, number>();

  for (const char of cleaned) {
    composition.set(char, (composition.get(char) || 0) + 1);
  }

  return composition;
}

/**
 * Calculate the percentage of each amino acid in a sequence.
 */
export function calculateCompositionPercentage(
  sequence: string | null | undefined
): Map<string, number> {
  const composition = calculateComposition(sequence);
  const total = getSequenceLength(sequence);

  if (total === 0) return new Map();

  const percentages = new Map<string, number>();
  for (const [aa, count] of composition) {
    percentages.set(aa, Math.round((count / total) * 1000) / 10); // Round to 1 decimal
  }

  return percentages;
}

/**
 * Check if a sequence is likely to cause expression issues.
 * Returns warnings (not errors) for potential problems.
 */
export function checkExpressionWarnings(
  sequence: string | null | undefined
): string[] {
  const warnings: string[] = [];
  const cleaned = cleanSequence(sequence);

  if (!cleaned) return warnings;

  const composition = calculateComposition(cleaned);
  const length = cleaned.length;

  // Check for high cysteine content (potential disulfide bond issues)
  const cysteineCount = composition.get("C") || 0;
  if (cysteineCount / length > 0.1) {
    warnings.push(
      `High cysteine content (${((cysteineCount / length) * 100).toFixed(1)}%) - may form disulfide bonds`
    );
  }

  // Check for consecutive rare codons (proline, glycine runs)
  if (/P{4,}/.test(cleaned)) {
    warnings.push("Contains proline runs (4+) - may affect folding");
  }
  if (/G{4,}/.test(cleaned)) {
    warnings.push("Contains glycine runs (4+) - may affect structure");
  }

  // Check for high hydrophobic content
  const hydrophobic = ["A", "V", "I", "L", "M", "F", "W"].reduce(
    (sum, aa) => sum + (composition.get(aa) || 0),
    0
  );
  if (hydrophobic / length > 0.5) {
    warnings.push(
      `High hydrophobic content (${((hydrophobic / length) * 100).toFixed(1)}%) - may have solubility issues`
    );
  }

  return warnings;
}
