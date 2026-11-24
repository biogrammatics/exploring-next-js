import { describe, it, expect } from "vitest";
import {
  molecularWeight,
  isoelectricPoint,
  extinctionCoefficient,
  findGlycosylationSequons,
  findKex2Sites,
  looksLikeNucleotide,
  analyzeProtein,
  formatMass,
} from "./protein-analysis";

describe("molecularWeight", () => {
  it("returns null for an empty sequence", () => {
    expect(molecularWeight("")).toBeNull();
    expect(molecularWeight(null)).toBeNull();
  });

  it("computes a single residue as residue mass plus water", () => {
    // Glycine 57.0519 + water 18.0153
    expect(molecularWeight("G")).toBeCloseTo(75.0672, 3);
  });

  it("matches the published average mass of insulin chain A", () => {
    const chainA = "GIVEQCCTSICSLYQLENYCN";
    expect(molecularWeight(chainA)).toBeCloseTo(2383.7, 0);
  });

  it("ignores whitespace and case in the input", () => {
    expect(molecularWeight(" g i v ")).toBeCloseTo(molecularWeight("GIV")!, 6);
  });
});

describe("isoelectricPoint", () => {
  it("returns null for an empty sequence", () => {
    expect(isoelectricPoint("")).toBeNull();
  });

  it("puts a strongly basic peptide at high pH", () => {
    const pI = isoelectricPoint("KKKKRRRR");
    expect(pI).toBeGreaterThan(11);
  });

  it("puts a strongly acidic peptide at low pH", () => {
    const pI = isoelectricPoint("DDDDEEEE");
    expect(pI).toBeLessThan(4.5);
  });

  it("is bounded to the search interval", () => {
    const pI = isoelectricPoint("GGGG");
    expect(pI).toBeGreaterThanOrEqual(0);
    expect(pI).toBeLessThanOrEqual(14);
  });
});

describe("extinctionCoefficient", () => {
  it("is zero for a peptide with no W, Y or C", () => {
    const e = extinctionCoefficient("GGGGAAAA");
    expect(e?.reduced).toBe(0);
    expect(e?.allCystines).toBe(0);
  });

  it("counts tryptophan at 5500 and tyrosine at 1490", () => {
    expect(extinctionCoefficient("W")?.reduced).toBe(5500);
    expect(extinctionCoefficient("Y")?.reduced).toBe(1490);
    expect(extinctionCoefficient("WWY")?.reduced).toBe(5500 * 2 + 1490);
  });

  it("adds cystine contribution only for complete pairs", () => {
    // One free cysteine cannot form a cystine.
    expect(extinctionCoefficient("WC")?.allCystines).toBe(5500);
    // Two cysteines make one cystine: +2 * 125.
    expect(extinctionCoefficient("WCC")?.allCystines).toBe(5500 + 250);
  });
});

describe("findGlycosylationSequons", () => {
  it("finds N-X-S and N-X-T", () => {
    expect(findGlycosylationSequons("NGS")).toEqual([{ position: 1, motif: "NGS" }]);
    expect(findGlycosylationSequons("NGT")).toEqual([{ position: 1, motif: "NGT" }]);
  });

  it("excludes proline at the X position", () => {
    expect(findGlycosylationSequons("NPS")).toEqual([]);
    expect(findGlycosylationSequons("NPT")).toEqual([]);
  });

  it("reports 1-based positions of every occurrence", () => {
    //            1234567
    const found = findGlycosylationSequons("AANGSNAT");
    expect(found.map((f) => f.position)).toEqual([3, 6]);
  });

  it("does not run off the end of the sequence", () => {
    expect(findGlycosylationSequons("NG")).toEqual([]);
    expect(findGlycosylationSequons("N")).toEqual([]);
  });
});

describe("findKex2Sites", () => {
  it("finds KR and RR dibasic pairs", () => {
    expect(findKex2Sites("AAKRAA")).toEqual([{ position: 3, motif: "KR" }]);
    expect(findKex2Sites("AARRAA")).toEqual([{ position: 3, motif: "RR" }]);
  });

  it("does not match RK or KK", () => {
    expect(findKex2Sites("AARKAA")).toEqual([]);
    expect(findKex2Sites("AAKKAA")).toEqual([]);
  });

  it("reports overlapping runs at each position", () => {
    // RRR contains RR at 1 and at 2.
    expect(findKex2Sites("RRR").map((k) => k.position)).toEqual([1, 2]);
  });
});

describe("looksLikeNucleotide", () => {
  it("flags a long run of ACGT", () => {
    expect(looksLikeNucleotide("ATGGCGACCGGTACGTAGCTAGCTAGC")).toBe(true);
  });

  it("does not flag a normal protein", () => {
    expect(looksLikeNucleotide("MKVLILACLVALALARELEELNVPGEIVESLSSSEE")).toBe(false);
  });

  it("does not flag short peptides that happen to use those letters", () => {
    // Too short to judge; the guard must not fire on a real tetrapeptide.
    expect(looksLikeNucleotide("GATC")).toBe(false);
  });
});

describe("analyzeProtein", () => {
  it("reports every field in one pass", () => {
    const a = analyzeProtein("MNGSCCWY");
    expect(a.length).toBe(8);
    expect(a.cysteineCount).toBe(2);
    expect(a.glycosylationSequons).toHaveLength(1);
    expect(a.molecularWeightDa).not.toBeNull();
    expect(a.isoelectricPoint).not.toBeNull();
  });

  it("is safe on empty input", () => {
    const a = analyzeProtein("");
    expect(a.length).toBe(0);
    expect(a.molecularWeightDa).toBeNull();
    expect(a.glycosylationSequons).toEqual([]);
  });
});

describe("formatMass", () => {
  it("renders kDa above 1000 Da and Da below", () => {
    expect(formatMass(24300)).toBe("24.3 kDa");
    expect(formatMass(812)).toBe("812 Da");
    expect(formatMass(null)).toBe("—");
  });
});
