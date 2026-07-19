import { describe, it, expect } from "vitest";
import {
  computeTotalScore,
  computeScoreDelta,
  parseTwistRepeatPairs,
  parseTwistCSV,
  breakTwistRepeats,
  type TwistRepeatPair,
} from "./repeat-breaker";
import { translateDna, type NinemerScores } from "./dp-optimizer";

const ALA_CODONS = ["GCT", "GCC", "GCA", "GCG"];

/**
 * Deterministic scores for every 3-alanine-codon 9-mer under the "AAA" triplet.
 * Non-trivial values so score deltas are actually exercised.
 */
function buildAlaScores(): NinemerScores {
  const scores: NinemerScores = { AAA: {} };
  let i = 1;
  for (const a of ALA_CODONS) {
    for (const b of ALA_CODONS) {
      for (const c of ALA_CODONS) {
        scores.AAA[a + b + c] = ((i * 37) % 101) / 7;
        i++;
      }
    }
  }
  return scores;
}

describe("computeScoreDelta consistency (the invariant the optimizer relies on)", () => {
  it("delta equals full recompute for every single-codon substitution", () => {
    const protein = "AAAAAA";
    const scores = buildAlaScores();
    const dna0 = "GCT".repeat(6);
    const before = computeTotalScore(dna0, protein, scores);

    for (let ci = 0; ci < 6; ci++) {
      for (const newCodon of ALA_CODONS) {
        if (newCodon === "GCT") continue;
        const after =
          dna0.slice(0, ci * 3) + newCodon + dna0.slice(ci * 3 + 3);
        const fullDelta = computeTotalScore(after, protein, scores) - before;
        const delta = computeScoreDelta(dna0, protein, scores, ci, newCodon);
        expect(delta).toBeCloseTo(fullDelta, 9);
      }
    }
  });
});

describe("parseTwistRepeatPairs", () => {
  it("pairs consecutive warning lines and converts to 0-indexed regions", () => {
    const warnings =
      "Repeat region detected (755 - 774)\nRepeat region detected (1199 - 1218)";
    const pairs = parseTwistRepeatPairs(warnings);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      pos1Start: 754,
      pos1End: 774,
      pos2Start: 1198,
      pos2End: 1218,
      exactMatchLen: 19,
    });
  });

  it("returns no pairs when there are no repeat warnings", () => {
    expect(parseTwistRepeatPairs("Complexity: OK")).toEqual([]);
  });
});

describe("parseTwistCSV", () => {
  it("parses rows including quoted fields", () => {
    const csv =
      'Name,Complexity,Warnings,Errors,Insert sequence\n' +
      '"gene1","OK","Repeat region detected (1 - 20)","","ATGCATGC"';
    const rows = parseTwistCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("gene1");
    expect(rows[0].insertSequence).toBe("ATGCATGC");
    expect(rows[0].warnings).toContain("Repeat region detected");
  });
});

describe("breakTwistRepeats", () => {
  // Two identical 15bp alanine blocks separated by a glycine spacer.
  const protein = "AAAAAGGAAAAA";
  const dna = "GCT".repeat(5) + "GGT".repeat(2) + "GCT".repeat(5); // 36 bp
  const pair: TwistRepeatPair = {
    pos1Start: 0,
    pos1End: 15,
    pos2Start: 21,
    pos2End: 36,
    exactMatchLen: 14,
  };

  it("breaks an active repeat while preserving the encoded protein", () => {
    const result = breakTwistRepeats(dna, protein, {}, [pair]);
    expect(result.pairsFixed).toBe(1);
    expect(result.pairsRemaining).toBe(0);
    expect(result.substitutionsMade.length).toBeGreaterThanOrEqual(1);
    // The whole point: the synonymous substitution must not change the protein.
    expect(translateDna(result.dnaSequence)).toBe(protein);
    // And the DNA actually changed.
    expect(result.dnaSequence).not.toBe(dna);
  });

  it("respects the score-penalty budget", () => {
    const scores = buildAlaScores();
    const result = breakTwistRepeats(dna, protein, scores, [pair], undefined, {
      maxScorePenaltyPct: 5,
    });
    const minAllowed = result.originalScore * (1 - 5 / 100);
    expect(result.newScore).toBeGreaterThanOrEqual(minAllowed);
  });

  it("reports a pair as not-active when there is no real repeat", () => {
    // A single 12bp region pair below the 14bp threshold: nothing to fix.
    const shortPair: TwistRepeatPair = {
      pos1Start: 0,
      pos1End: 12,
      pos2Start: 21,
      pos2End: 33,
      exactMatchLen: 11,
    };
    const result = breakTwistRepeats(dna, protein, {}, [shortPair]);
    expect(result.substitutionsMade).toHaveLength(0);
  });
});
