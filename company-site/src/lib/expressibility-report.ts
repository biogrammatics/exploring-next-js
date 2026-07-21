/**
 * Pichia Expressibility Pre-Screen
 *
 * Generates an advisory report flagging potential problems with expressing a
 * customer's protein sequence in Pichia pastoris (Komagataella phaffii). This
 * is intentionally NOT definitive — it surfaces things the customer should
 * "look at more carefully before proceeding" (e.g. transmembrane domains that
 * preclude secretion, internal Kex2 sites that get clipped, repeats that
 * complicate DNA synthesis).
 *
 * Scope note: BioGrammatics vectors carry no built-in secretion signal — the
 * secretion leader is added to the ORF as a separate step — so this report
 * assumes a SECRETED expression strategy. Flags whose relevance depends on the
 * protein transiting the secretory pathway (Kex2, N-glycosylation) are
 * evaluated on that basis.
 *
 * Pure, dependency-free. All analyses are sequence heuristics; DNA-synthesis
 * risk is taken from the Twist scoring already performed by the worker.
 */

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** Kyte-Doolittle hydropathy index (higher = more hydrophobic). */
const KYTE_DOOLITTLE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4,
  H: -3.2, I: 4.5, L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8,
  T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
};

/** Average residue masses in Daltons (for approximate molecular weight). */
const RESIDUE_MASS: Record<string, number> = {
  A: 71.08, R: 156.19, N: 114.10, D: 115.09, C: 103.14, E: 129.12, Q: 128.13,
  G: 57.05, H: 137.14, I: 113.16, L: 113.16, K: 128.17, M: 131.19, F: 147.18,
  P: 97.12, S: 87.08, T: 101.10, W: 186.21, Y: 163.18, V: 99.13,
};
const WATER_MASS = 18.02;

// TM prediction tuning (Kyte-Doolittle sliding window).
const TM_WINDOW = 19;
const TM_THRESHOLD = 1.6;
const TM_MIN_SEGMENT = 12; // min residues above threshold to call a helix
const N_TERMINAL_CUTOFF = 25; // a TM segment starting before this = likely signal/anchor

// Sequence-level thresholds.
const HOMOPOLYMER_MIN_RUN = 6;
const LARGE_PROTEIN_AA = 1000;
const NOTABLE_PROTEIN_AA = 600;
const HIGH_CYSTEINE_COUNT = 8;
const HIGH_NGLYC_COUNT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagSeverity = "blocker" | "caution" | "note";

export interface ExpressibilityFlag {
  /** Stable identifier, e.g. "transmembrane", "kex2-sites". */
  id: string;
  severity: FlagSeverity;
  title: string;
  /** What was detected in this sequence. */
  finding: string;
  /** Why it matters for secreted expression in Pichia. */
  rationale: string;
  /** Suggested action for the customer. */
  recommendation: string;
  /** 1-based amino-acid positions, when applicable. */
  positions?: number[];
}

/** Twist synthesizability fields already stored on the job. */
export interface TwistSynthesisInput {
  twistScore?: string | null; // "BUILDABLE" | "UNBUILDABLE"
  twistDifficulty?: string | null; // "STANDARD" | "COMPLEX" | "NOT ACCEPTED"
  twistErrors?: string | null; // JSON array of Twist issue objects
}

export interface ExpressibilityReportOptions {
  dnaSequence?: string;
  twist?: TwistSynthesisInput;
  /** ISO timestamp; defaults to now. Injectable for deterministic tests. */
  generatedAt?: string;
}

export interface ExpressibilityReport {
  expressionStrategy: "secreted";
  generatedAt: string;
  metrics: {
    lengthAa: number;
    molecularWeightKda: number;
    cysteineCount: number;
    predictedTmSegments: number;
    nGlycSequons: number;
    kex2Sites: number;
  };
  summary: {
    blockers: number;
    cautions: number;
    notes: number;
    overall: "high-risk" | "review" | "clear";
  };
  flags: ExpressibilityFlag[];
}

interface TmSegment {
  start: number; // 1-based
  end: number; // 1-based inclusive
  center: number; // 1-based
}

// ---------------------------------------------------------------------------
// Individual analyses
// ---------------------------------------------------------------------------

/** Smoothed Kyte-Doolittle hydropathy profile (window-averaged, per residue). */
function hydropathyProfile(seq: string, window = TM_WINDOW): number[] {
  const half = Math.floor(window / 2);
  const profile: number[] = new Array(seq.length).fill(0);
  for (let i = 0; i < seq.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < seq.length) {
        sum += KYTE_DOOLITTLE[seq[j]] ?? 0;
        n++;
      }
    }
    profile[i] = n > 0 ? sum / n : 0;
  }
  return profile;
}

/** Predict transmembrane segments as runs of high smoothed hydropathy. */
function predictTmSegments(seq: string): TmSegment[] {
  const profile = hydropathyProfile(seq);
  const segments: TmSegment[] = [];
  let runStart = -1;
  for (let i = 0; i <= profile.length; i++) {
    const above = i < profile.length && profile[i] >= TM_THRESHOLD;
    if (above && runStart === -1) {
      runStart = i;
    } else if (!above && runStart !== -1) {
      const len = i - runStart;
      if (len >= TM_MIN_SEGMENT) {
        segments.push({
          start: runStart + 1,
          end: i,
          center: Math.floor((runStart + i) / 2) + 1,
        });
      }
      runStart = -1;
    }
  }
  return segments;
}

/** Find internal Kex2 dibasic cleavage sites (KR, RR). Returns cut positions. */
function findKex2Sites(seq: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const pair = seq[i] + seq[i + 1];
    if (pair === "KR" || pair === "RR") {
      positions.push(i + 1); // 1-based position of first residue of the pair
    }
  }
  return positions;
}

/** Find N-glycosylation sequons N-X-[S/T], X != P. Returns positions of the N. */
function findNGlycSequons(seq: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < seq.length - 2; i++) {
    if (
      seq[i] === "N" &&
      seq[i + 1] !== "P" &&
      (seq[i + 2] === "S" || seq[i + 2] === "T")
    ) {
      positions.push(i + 1);
    }
  }
  return positions;
}

/** Find homopolymer / low-complexity runs of a single residue. */
function findHomopolymerRuns(
  seq: string
): { residue: string; start: number; length: number }[] {
  const runs: { residue: string; start: number; length: number }[] = [];
  let i = 0;
  while (i < seq.length) {
    let j = i;
    while (j < seq.length && seq[j] === seq[i]) j++;
    const len = j - i;
    if (len >= HOMOPOLYMER_MIN_RUN) {
      runs.push({ residue: seq[i], start: i + 1, length: len });
    }
    i = j;
  }
  return runs;
}

function molecularWeightKda(seq: string): number {
  let mass = WATER_MASS;
  for (const aa of seq) mass += RESIDUE_MASS[aa] ?? 0;
  return Math.round((mass / 1000) * 10) / 10;
}

function summarizePositions(positions: number[], max = 12): string {
  if (positions.length <= max) return positions.join(", ");
  return positions.slice(0, max).join(", ") + `, … (+${positions.length - max} more)`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate an advisory expressibility report for a (mature) protein sequence.
 * Assumes a secreted expression strategy.
 */
export function generateExpressibilityReport(
  proteinSequence: string,
  opts: ExpressibilityReportOptions = {}
): ExpressibilityReport {
  const seq = proteinSequence.replace(/\s/g, "").toUpperCase();
  const flags: ExpressibilityFlag[] = [];

  // --- Transmembrane domains -------------------------------------------------
  const tmSegments = predictTmSegments(seq);
  if (tmSegments.length > 0) {
    const ranges = tmSegments.map((s) => `${s.start}-${s.end}`).join(", ");
    const nTerminalOnly =
      tmSegments.length === 1 && tmSegments[0].center <= N_TERMINAL_CUTOFF;

    if (nTerminalOnly) {
      flags.push({
        id: "n-terminal-hydrophobic",
        severity: "caution",
        title: "N-terminal hydrophobic segment",
        finding: `A single hydrophobic segment near the N-terminus (residues ${ranges}).`,
        rationale:
          "This may be a native signal peptide or a membrane anchor. Since a secretion leader is added to the ORF, a native N-terminal signal/anchor can conflict with the added leader or mislocalize the protein.",
        recommendation:
          "Confirm whether this is a native signal sequence; if so, consider removing it before adding the BioGrammatics secretion leader.",
        positions: [tmSegments[0].center],
      });
    } else {
      const polytopic = tmSegments.length >= 2;
      flags.push({
        id: "transmembrane",
        severity: polytopic ? "blocker" : "caution",
        title: polytopic
          ? `Predicted membrane protein (${tmSegments.length} TM segments)`
          : "Predicted transmembrane segment",
        finding: `${tmSegments.length} hydrophobic segment(s) consistent with transmembrane helices (residues ${ranges}).`,
        rationale: polytopic
          ? "Polytopic membrane proteins are retained in the membrane and are not secreted; they are also frequently toxic to the host."
          : "An internal transmembrane segment typically anchors the protein in the membrane, preventing efficient secretion.",
        recommendation:
          "If secretion is the goal, this protein is a poor candidate. Consider expressing only a soluble domain, or an intracellular strategy.",
        positions: tmSegments.map((s) => s.center),
      });
    }
  }

  // --- Internal Kex2 sites ---------------------------------------------------
  const kex2 = findKex2Sites(seq);
  if (kex2.length > 0) {
    flags.push({
      id: "kex2-sites",
      severity: "caution",
      title: `Internal Kex2 cleavage site(s) (${kex2.length})`,
      finding: `Dibasic KR/RR motif(s) at position(s): ${summarizePositions(kex2)}.`,
      rationale:
        "The Kex2 protease in the secretory pathway cleaves after KR/RR dibasic sites. Internal sites in a secreted protein can be clipped, yielding a truncated product.",
      recommendation:
        "Review these sites; if a truncated product is observed, consider conservative substitutions to remove the internal dibasic motif.",
      positions: kex2,
    });
  }

  // --- N-glycosylation sequons ----------------------------------------------
  const nGlyc = findNGlycSequons(seq);
  if (nGlyc.length > 0) {
    flags.push({
      id: "n-glycosylation",
      severity: nGlyc.length >= HIGH_NGLYC_COUNT ? "caution" : "note",
      title: `N-glycosylation sequon(s) (${nGlyc.length})`,
      finding: `N-X-[S/T] sequon(s) at position(s): ${summarizePositions(nGlyc)}.`,
      rationale:
        "Pichia adds high-mannose N-glycans and can hypermannosylate, producing heterogeneous glycoforms — a concern for therapeutic or structural work.",
      recommendation:
        "If uniform, human-like glycosylation matters, consider a glyco-engineered strain or removing non-essential sequons.",
      positions: nGlyc,
    });
  }

  // --- Cysteine / disulfide load --------------------------------------------
  // A lone (or single-pair) cysteine is common and rarely a problem, so only
  // flag when the count is high (folding burden) or odd AND high enough that
  // disulfide pairing is plausibly intended.
  const cysCount = (seq.match(/C/g) || []).length;
  const oddCys = cysCount % 2 === 1 && cysCount >= 3;
  if (cysCount >= HIGH_CYSTEINE_COUNT || oddCys) {
    flags.push({
      id: "cysteine-load",
      severity: cysCount >= HIGH_CYSTEINE_COUNT ? "caution" : "note",
      title: oddCys
        ? `Odd cysteine count (${cysCount})`
        : `High cysteine content (${cysCount})`,
      finding: `${cysCount} cysteine residue(s)${oddCys ? " (odd number — possible unpaired Cys)" : ""}.`,
      rationale:
        "Multiple disulfide bonds increase the folding/oxidation burden in the secretory pathway and can limit secreted yield; an unpaired cysteine can cause misfolding or aggregation.",
      recommendation:
        "For disulfide-rich proteins, expect folding to be rate-limiting; co-expression of foldases or slower induction may help.",
    });
  }

  // --- Size ------------------------------------------------------------------
  if (seq.length >= NOTABLE_PROTEIN_AA) {
    flags.push({
      id: "large-protein",
      severity: seq.length >= LARGE_PROTEIN_AA ? "caution" : "note",
      title: `Large protein (${seq.length} aa)`,
      finding: `${seq.length} residues (~${molecularWeightKda(seq)} kDa).`,
      rationale:
        "Secreted yield tends to fall with size, and large ORFs are more expensive/difficult to synthesize.",
      recommendation:
        "If only a functional domain is needed, expressing that domain often secretes far better.",
    });
  }

  // --- C-terminal ER-retention signal ---------------------------------------
  const cTerm = seq.slice(-4);
  if (cTerm === "HDEL" || cTerm === "KDEL") {
    flags.push({
      id: "er-retention",
      severity: "caution",
      title: "C-terminal ER-retention signal",
      finding: `Sequence ends in ${cTerm}.`,
      rationale:
        "HDEL/KDEL is an ER-retention signal; the protein would be retained in the ER rather than secreted.",
      recommendation:
        "Remove the C-terminal retention signal if secretion into the medium is intended.",
    });
  }

  // --- Low-complexity / homopolymer runs ------------------------------------
  const runs = findHomopolymerRuns(seq);
  if (runs.length > 0) {
    const desc = runs
      .map((r) => `${r.length}×${r.residue} @ ${r.start}`)
      .join(", ");
    flags.push({
      id: "low-complexity",
      severity: "caution",
      title: `Low-complexity / homopolymer run(s) (${runs.length})`,
      finding: `Run(s): ${desc}.`,
      rationale:
        "Amino-acid repeats produce repetitive DNA that is harder and costlier to synthesize and can be genetically unstable.",
      recommendation:
        "These regions may raise synthesis cost or fail; codon diversification helps but cannot always resolve long repeats.",
      positions: runs.map((r) => r.start),
    });
  }

  // --- DNA synthesis risk (from Twist) --------------------------------------
  if (opts.twist) {
    const { twistScore, twistDifficulty, twistErrors } = opts.twist;
    const issues = parseTwistIssues(twistErrors);
    const issueText =
      issues.length > 0 ? ` Issues: ${issues.join("; ")}.` : "";
    const unbuildable =
      twistScore === "UNBUILDABLE" || twistDifficulty === "NOT ACCEPTED";
    const complex = twistDifficulty === "COMPLEX";

    if (unbuildable) {
      flags.push({
        id: "dna-synthesis",
        severity: "blocker",
        title: "DNA synthesis not accepted",
        finding: `Twist flagged the optimized ORF as ${twistDifficulty || twistScore}.${issueText}`,
        rationale:
          "The optimized coding sequence, as designed, cannot be synthesized by the standard pipeline.",
        recommendation:
          "Re-optimize (different codon choices) or split the gene; the problematic regions above are the usual cause.",
      });
    } else if (complex) {
      flags.push({
        id: "dna-synthesis",
        severity: "caution",
        title: "Complex DNA synthesis",
        finding: `Twist rated the optimized ORF COMPLEX.${issueText}`,
        rationale:
          "Complex sequences carry higher synthesis cost and a greater chance of build delays or failure.",
        recommendation:
          "Usually still buildable; expect longer turnaround. Re-optimization may downgrade it to STANDARD.",
      });
    }
  }

  // --- Summary ---------------------------------------------------------------
  const blockers = flags.filter((f) => f.severity === "blocker").length;
  const cautions = flags.filter((f) => f.severity === "caution").length;
  const notes = flags.filter((f) => f.severity === "note").length;
  const overall = blockers > 0 ? "high-risk" : cautions > 0 ? "review" : "clear";

  // Order flags by severity for presentation.
  const rank: Record<FlagSeverity, number> = { blocker: 0, caution: 1, note: 2 };
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    expressionStrategy: "secreted",
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    metrics: {
      lengthAa: seq.length,
      molecularWeightKda: molecularWeightKda(seq),
      cysteineCount: cysCount,
      predictedTmSegments: tmSegments.length,
      nGlycSequons: nGlyc.length,
      kex2Sites: kex2.length,
    },
    summary: { blockers, cautions, notes, overall },
    flags,
  };
}

/** Parse the Twist issues JSON blob into short human-readable strings. */
function parseTwistIssues(twistErrors?: string | null): string[] {
  if (!twistErrors) return [];
  try {
    const parsed = JSON.parse(twistErrors);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((issue) => {
        if (typeof issue === "string") return issue;
        if (issue && typeof issue === "object") {
          return (
            issue.message || issue.name || issue.type || JSON.stringify(issue)
          );
        }
        return String(issue);
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
