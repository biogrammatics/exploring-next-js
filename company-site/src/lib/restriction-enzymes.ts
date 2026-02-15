/**
 * Restriction Enzyme Registry
 *
 * Centralizes restriction enzyme data and vector/promoter-to-enzyme mappings.
 * Used to dynamically generate exclusion patterns based on user's choice of
 * cloning vector and assembly strategy.
 */

export interface RestrictionEnzyme {
  name: string;
  recognitionSequence: string;
  enzymeType: 'TypeII' | 'TypeIIS';
}

// Master registry of restriction enzymes relevant to BioGrammatics vectors
export const RESTRICTION_ENZYMES: Record<string, RestrictionEnzyme> = {
  PmeI:  { name: 'PmeI',  recognitionSequence: 'GTTTAAAC', enzymeType: 'TypeII' },
  SwaI:  { name: 'SwaI',  recognitionSequence: 'ATTTAAAT', enzymeType: 'TypeII' },
  EcoRI: { name: 'EcoRI', recognitionSequence: 'GAATTC',  enzymeType: 'TypeII' },
  BamHI: { name: 'BamHI', recognitionSequence: 'GGATCC',  enzymeType: 'TypeII' },
  NotI:  { name: 'NotI',  recognitionSequence: 'GCGGCCGC', enzymeType: 'TypeII' },
  XhoI:  { name: 'XhoI',  recognitionSequence: 'CTCGAG',  enzymeType: 'TypeII' },
  XbaI:  { name: 'XbaI',  recognitionSequence: 'TCTAGA',  enzymeType: 'TypeII' },
  SacII: { name: 'SacII', recognitionSequence: 'CCGCGG',  enzymeType: 'TypeII' },
  KpnI:  { name: 'KpnI',  recognitionSequence: 'GGTACC',  enzymeType: 'TypeII' },
  AvrII: { name: 'AvrII', recognitionSequence: 'CCTAGG',  enzymeType: 'TypeII' },
  EcoRV: { name: 'EcoRV', recognitionSequence: 'GATATC',  enzymeType: 'TypeII' },
  AleI:  { name: 'AleI',  recognitionSequence: 'CACNNNNGTG', enzymeType: 'TypeII' },

  // Type IIS enzymes (used in Golden Gate assembly)
  BsaI:  { name: 'BsaI',  recognitionSequence: 'GGTCTC',  enzymeType: 'TypeIIS' },
  BbsI:  { name: 'BbsI',  recognitionSequence: 'GAAGAC',  enzymeType: 'TypeIIS' },
  BsmBI: { name: 'BsmBI', recognitionSequence: 'CGTCTC',  enzymeType: 'TypeIIS' },
  SapI:  { name: 'SapI',  recognitionSequence: 'GCTCTTC', enzymeType: 'TypeIIS' },
};

// Enzymes excluded when Golden Gate assembly toggle is on
export const GOLDEN_GATE_ENZYMES: string[] = ['BsaI', 'BbsI', 'BsmBI', 'SapI'];

// Mapping: promoter name → restriction enzymes to exclude from the insert.
// These are enzymes whose recognition sites exist within the promoter sequence
// and must not appear in the optimized ORF to avoid unwanted cutting.
// TODO: In the future, derive this from the actual vector/promoter sequences in the DB.
export const PROMOTER_RESTRICTION_SITES: Record<string, string[]> = {
  'AOX1': ['PmeI', 'SwaI'],
  'GAP':  ['PmeI'],
  'PGK1': ['PmeI'],
  'FLD1': ['PmeI'],
  'TEF1': ['PmeI'],
};

// IUPAC degenerate base complements
const IUPAC_COMPLEMENT: Record<string, string> = {
  A: 'T', T: 'A', G: 'C', C: 'G',
  N: 'N', R: 'Y', Y: 'R', M: 'K', K: 'M',
  S: 'S', W: 'W', B: 'V', V: 'B', D: 'H', H: 'D',
};

// IUPAC degenerate base to regex character class
const IUPAC_TO_REGEX: Record<string, string> = {
  A: 'A', T: 'T', G: 'G', C: 'C',
  N: '[ACGT]', R: '[AG]', Y: '[CT]', M: '[AC]', K: '[GT]',
  S: '[GC]', W: '[AT]', B: '[CGT]', V: '[ACG]', D: '[AGT]', H: '[ACT]',
};

/**
 * Reverse complement of a DNA sequence (supports IUPAC degenerate bases)
 */
function reverseComplement(seq: string): string {
  return seq.split('').reverse().map(b => IUPAC_COMPLEMENT[b] || b).join('');
}

/**
 * Convert a recognition sequence (possibly with IUPAC degenerate bases)
 * to a regex pattern string.
 */
function recognitionToRegex(seq: string): string {
  return seq.split('').map(b => IUPAC_TO_REGEX[b] || b).join('');
}

/**
 * Convert enzyme names to the exclusion pattern text format
 * consumed by parseExclusionPatterns() in both optimizers.
 *
 * For non-palindromic sites, includes both the recognition sequence
 * and its reverse complement (since the enzyme cuts either strand).
 */
export function enzymeNamesToExclusionPatterns(enzymeNames: string[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const name of enzymeNames) {
    const enzyme = RESTRICTION_ENZYMES[name];
    if (!enzyme) continue;

    const seq = enzyme.recognitionSequence.toUpperCase();
    const rc = reverseComplement(seq);

    // Use regex pattern if the sequence contains degenerate bases
    const hasDegenerate = /[^ACGT]/.test(seq);
    const fwdPattern = hasDegenerate ? recognitionToRegex(seq) : seq;
    const rcPattern = hasDegenerate ? recognitionToRegex(rc) : rc;

    if (!seen.has(fwdPattern)) {
      lines.push(`${fwdPattern}  # ${enzyme.name}`);
      seen.add(fwdPattern);
    }
    if (rcPattern !== fwdPattern && !seen.has(rcPattern)) {
      lines.push(`${rcPattern}  # ${enzyme.name} (reverse complement)`);
      seen.add(rcPattern);
    }
  }

  return lines.join('\n');
}

/**
 * Get enzyme names to exclude for a given promoter
 */
export function getEnzymesForPromoter(promoterName: string): string[] {
  return PROMOTER_RESTRICTION_SITES[promoterName] || [];
}
