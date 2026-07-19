import { describe, it, expect } from "vitest";
import {
  translateDna,
  DPCodonOptimizer,
  type NinemerScores,
} from "./dp-optimizer";

describe("translateDna", () => {
  it("translates codons to amino acids", () => {
    expect(translateDna("GCTGCT")).toBe("AA");
    expect(translateDna("ATGGCT")).toBe("MA");
  });
  it("stops at a stop codon", () => {
    expect(translateDna("ATGGCTTAAGCT")).toBe("MA");
  });
  it("ignores a trailing incomplete codon", () => {
    expect(translateDna("GCTG")).toBe("A");
  });
});

describe("DPCodonOptimizer.optimize", () => {
  const emptyScores: NinemerScores = {};

  it("produces DNA that translates back to the input protein", () => {
    const opt = new DPCodonOptimizer(emptyScores);
    const protein = "MAAAGGT";
    const r = opt.optimize(protein);
    expect(r.success).toBe(true);
    expect(r.dnaSequence).toBeDefined();
    expect(r.dnaSequence!.length).toBe(protein.length * 3);
    expect(translateDna(r.dnaSequence!)).toBe(protein);
  });

  it("is deterministic for identical inputs", () => {
    const protein = "MAGWYVAAT";
    const a = new DPCodonOptimizer(emptyScores).optimize(protein);
    const b = new DPCodonOptimizer(emptyScores).optimize(protein);
    expect(a.dnaSequence).toBe(b.dnaSequence);
  });

  it("rejects invalid amino acids", () => {
    const r = new DPCodonOptimizer(emptyScores).optimize("MAXA");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Invalid amino acid: X/);
  });

  it("rejects sequences shorter than 2 residues", () => {
    const r = new DPCodonOptimizer(emptyScores).optimize("A");
    expect(r.success).toBe(false);
  });

  it("never emits an excluded codon in the output", () => {
    const r = new DPCodonOptimizer(emptyScores).optimize("AAAAAAAA", "GCG");
    expect(r.success).toBe(true);
    expect(r.dnaSequence).not.toContain("GCG");
  });

  it("fails cleanly when exclusions eliminate every candidate", () => {
    // Every alanine codon contains "GC", so nothing survives.
    const r = new DPCodonOptimizer(emptyScores).optimize("AAAAAA", "GC");
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it("prefers higher-scoring codons when a scoring matrix is provided", () => {
    // Score the 9-mer for triplet "AAA" that is all-GCA very highly; the
    // optimizer should choose it over the default GCT-heavy solution.
    const scores: NinemerScores = { AAA: { GCAGCAGCA: 100 } };
    const r = new DPCodonOptimizer(scores).optimize("AAAAA");
    expect(r.success).toBe(true);
    expect(r.dnaSequence).toContain("GCAGCAGCA");
    expect(r.score).toBeGreaterThan(0);
  });
});
