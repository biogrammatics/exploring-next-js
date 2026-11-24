/**
 * Physicochemical analysis of a protein sequence, for the design tools.
 *
 * Complements, and does not replace, the existing modules:
 *  - `amino-acid-validation.ts` owns cleaning, composition and the rough
 *    catalog-display weight estimate (length x 110 Da).
 *  - `codon-optimization.ts` owns `validateProteinSequence`, which is the only
 *    accepted gate for anything that will be built into a gene.
 *
 * What lives here is the chemistry the design wizard shows a customer before
 * they commit to a construct: an accurate mass, pI, extinction coefficient,
 * and the two motif classes that change how a secreted protein is processed.
 *
 * Every function takes raw user input and cleans it first, so callers do not
 * have to remember to.
 */

import { cleanSequence } from "./amino-acid-validation";

/**
 * Average isotopic residue masses in Daltons (the free amino acid minus one
 * water, since residues are joined by peptide bonds). Adding one water for the
 * free termini gives the peptide mass.
 */
const RESIDUE_MASS: Readonly<Record<string, number>> = {
  A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388,
  E: 129.1155, Q: 128.1307, G: 57.0519, H: 137.1411, I: 113.1594,
  L: 113.1594, K: 128.1741, M: 131.1926, F: 147.1766, P: 97.1167,
  S: 87.0782, T: 101.1051, W: 186.2132, Y: 163.1760, V: 99.1326,
};

const WATER_MASS = 18.0153;

/**
 * pKa values for the ionizable groups, used for the pI bisection.
 * EMBOSS/Expasy-style set; good to about +/- 0.1 pH unit for most proteins.
 */
const PKA = {
  cTerminus: 3.65,
  nTerminus: 8.2,
  D: 3.9, E: 4.07, C: 8.37, Y: 10.46, H: 6.04, K: 10.54, R: 12.48,
} as const;

/** Molar extinction coefficients at 280 nm (Gill & von Hippel). */
const EXT_TRP = 5500;
const EXT_TYR = 1490;
const EXT_CYSTINE = 125;

function countResidue(sequence: string, residue: string): number {
  let n = 0;
  for (const ch of sequence) if (ch === residue) n += 1;
  return n;
}

/**
 * Accurate average molecular weight in Daltons, or null for an empty sequence.
 *
 * Unknown characters are skipped rather than guessed. Callers that need to
 * reject them should run `validateProteinSequence` first.
 */
export function molecularWeight(sequence: string | null | undefined): number | null {
  const seq = cleanSequence(sequence);
  if (seq.length === 0) return null;

  let mass = WATER_MASS;
  for (const ch of seq) {
    const residue = RESIDUE_MASS[ch];
    if (residue !== undefined) mass += residue;
  }
  return mass;
}

/** Net charge of the sequence at a given pH. */
function netCharge(sequence: string, pH: number): number {
  const positive = (pKa: number) => 1 / (1 + Math.pow(10, pH - pKa));
  const negative = (pKa: number) => -1 / (1 + Math.pow(10, pKa - pH));

  return (
    positive(PKA.nTerminus) +
    countResidue(sequence, "K") * positive(PKA.K) +
    countResidue(sequence, "R") * positive(PKA.R) +
    countResidue(sequence, "H") * positive(PKA.H) +
    negative(PKA.cTerminus) +
    countResidue(sequence, "D") * negative(PKA.D) +
    countResidue(sequence, "E") * negative(PKA.E) +
    countResidue(sequence, "C") * negative(PKA.C) +
    countResidue(sequence, "Y") * negative(PKA.Y)
  );
}

/**
 * Isoelectric point, found by bisecting net charge over pH 0-14.
 *
 * Net charge is monotonically decreasing in pH, so bisection always converges;
 * 100 iterations takes the interval well below display precision.
 */
export function isoelectricPoint(sequence: string | null | undefined): number | null {
  const seq = cleanSequence(sequence);
  if (seq.length === 0) return null;

  let low = 0;
  let high = 14;
  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    if (netCharge(seq, mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export interface ExtinctionCoefficient {
  /** All cysteines reduced (free thiols contribute nothing at 280 nm). */
  reduced: number;
  /** All cysteines paired as cystines, the upper bound. */
  allCystines: number;
  /** A280 of a 1 mg/mL solution, reduced case. Null if the mass is unknown. */
  a280Reduced: number | null;
}

/**
 * Molar extinction coefficient at 280 nm, in M^-1 cm^-1.
 *
 * Both bounds are reported because whether the cysteines actually form
 * disulfides is a property of the folded protein, not of the sequence.
 */
export function extinctionCoefficient(
  sequence: string | null | undefined
): ExtinctionCoefficient | null {
  const seq = cleanSequence(sequence);
  if (seq.length === 0) return null;

  const tryptophans = countResidue(seq, "W");
  const tyrosines = countResidue(seq, "Y");
  const cysteines = countResidue(seq, "C");

  const reduced = tryptophans * EXT_TRP + tyrosines * EXT_TYR;
  const allCystines = reduced + Math.floor(cysteines / 2) * 2 * EXT_CYSTINE;

  const mass = molecularWeight(seq);
  return {
    reduced,
    allCystines,
    a280Reduced: mass !== null && mass > 0 ? reduced / mass : null,
  };
}

export interface SequenceMotif {
  /** 1-based position of the first residue of the motif. */
  position: number;
  /** The matched residues, e.g. "NGT" or "KR". */
  motif: string;
}

/**
 * N-linked glycosylation sequons: N-X-S/T where X is any residue except
 * proline. Matches are reported 1-based, on the asparagine.
 *
 * A sequon is necessary but not sufficient for glycosylation — occupancy
 * depends on the folded structure — so these are reported as candidates.
 */
export function findGlycosylationSequons(
  sequence: string | null | undefined
): SequenceMotif[] {
  const seq = cleanSequence(sequence);
  const found: SequenceMotif[] = [];

  for (let i = 0; i + 2 < seq.length; i += 1) {
    const x = seq[i + 2];
    if (seq[i] === "N" && seq[i + 1] !== "P" && (x === "S" || x === "T")) {
      found.push({ position: i + 1, motif: seq.slice(i, i + 3) });
    }
  }
  return found;
}

/**
 * Dibasic Kex2 recognition sites (KR or RR).
 *
 * Kex2 cleaves after the dibasic pair in the late Golgi. An internal site in
 * the mature protein means a secreted product can be clipped in two, so these
 * are worth surfacing before a leader is chosen.
 */
export function findKex2Sites(sequence: string | null | undefined): SequenceMotif[] {
  const seq = cleanSequence(sequence);
  const found: SequenceMotif[] = [];

  for (let i = 0; i + 1 < seq.length; i += 1) {
    const pair = seq.slice(i, i + 2);
    if (pair === "KR" || pair === "RR") {
      found.push({ position: i + 1, motif: pair });
    }
  }
  return found;
}

/**
 * Heuristic: does this look like someone pasted DNA into a protein box?
 *
 * ACGTUN are all valid amino acid letters too (Ala, Cys, Gly, Thr, Sec, Asn),
 * so a short peptide can trip this. Used only to offer a hint, never to reject.
 */
export function looksLikeNucleotide(sequence: string | null | undefined): boolean {
  const seq = cleanSequence(sequence);
  if (seq.length < 12) return false;

  let nucleotideLike = 0;
  for (const ch of seq) {
    if (ch === "A" || ch === "C" || ch === "G" || ch === "T" || ch === "U" || ch === "N") {
      nucleotideLike += 1;
    }
  }
  return nucleotideLike / seq.length > 0.9;
}

export interface ProteinAnalysis {
  length: number;
  molecularWeightDa: number | null;
  isoelectricPoint: number | null;
  extinction: ExtinctionCoefficient | null;
  glycosylationSequons: SequenceMotif[];
  kex2Sites: SequenceMotif[];
  cysteineCount: number;
  looksLikeNucleotide: boolean;
}

/** Everything the design wizard shows about a pasted sequence, in one pass. */
export function analyzeProtein(sequence: string | null | undefined): ProteinAnalysis {
  const seq = cleanSequence(sequence);
  return {
    length: seq.length,
    molecularWeightDa: molecularWeight(seq),
    isoelectricPoint: isoelectricPoint(seq),
    extinction: extinctionCoefficient(seq),
    glycosylationSequons: findGlycosylationSequons(seq),
    kex2Sites: findKex2Sites(seq),
    cysteineCount: countResidue(seq, "C"),
    looksLikeNucleotide: looksLikeNucleotide(seq),
  };
}

/** "24.3 kDa" / "812 Da" for display. */
export function formatMass(massDa: number | null): string {
  if (massDa === null) return "—";
  if (massDa >= 1000) return `${(massDa / 1000).toFixed(1)} kDa`;
  return `${Math.round(massDa)} Da`;
}
