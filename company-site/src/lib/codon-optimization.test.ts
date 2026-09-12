import { describe, it, expect } from "vitest";
import {
  validateProteinSequence,
  validateExclusionPattern,
  MAX_PROTEIN_LENGTH,
  MAX_EXCLUSION_PATTERN_LENGTH,
} from "./codon-optimization";

describe("validateProteinSequence", () => {
  it("strips exactly one trailing stop codon", () => {
    const result = validateProteinSequence("MKVLW*");
    expect(result.isValid).toBe(true);
    expect(result.cleanedSequence).toBe("MKVLW");
    expect(result.length).toBe(5);
    expect(result.errors).toEqual([]);
  });

  it("rejects an internal stop codon with its 1-based position", () => {
    const result = validateProteinSequence("MK*VLW");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Internal stop codon at position 3");
  });

  it("rejects two trailing stop codons (the second is internal after stripping)", () => {
    const result = validateProteinSequence("MKVLW**");
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("Internal stop codon"))).toBe(true);
  });

  it("rejects sequences longer than MAX_PROTEIN_LENGTH", () => {
    const result = validateProteinSequence("A".repeat(MAX_PROTEIN_LENGTH + 1));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("too long"))).toBe(true);
  });

  it("accepts a sequence of exactly MAX_PROTEIN_LENGTH", () => {
    const result = validateProteinSequence("A".repeat(MAX_PROTEIN_LENGTH));
    expect(result.isValid).toBe(true);
    expect(result.length).toBe(MAX_PROTEIN_LENGTH);
  });

  it("cleans whitespace, digits and lowercase", () => {
    const result = validateProteinSequence("1 mkv\n2 lw*\n");
    expect(result.isValid).toBe(true);
    expect(result.cleanedSequence).toBe("MKVLW");
  });

  it("rejects an empty sequence", () => {
    expect(validateProteinSequence("  \n").isValid).toBe(false);
    // A lone terminator is empty after stripping
    expect(validateProteinSequence("*").isValid).toBe(false);
  });
});

describe("validateExclusionPattern", () => {
  it("accepts plain nucleotide patterns", () => {
    expect(validateExclusionPattern("GGTCTC")).toEqual({ ok: true });
    expect(validateExclusionPattern("GAGACC")).toEqual({ ok: true });
    expect(validateExclusionPattern("gttaaac")).toEqual({ ok: true });
  });

  it("accepts character classes with bounded quantifiers", () => {
    expect(validateExclusionPattern("CAC[ACGT]{4}GTG")).toEqual({ ok: true });
    expect(validateExclusionPattern("GCN{3}GC")).toEqual({ ok: true });
  });

  it("rejects regex operators that enable backtracking or alternation", () => {
    for (const bad of ["(A+)+$", "A|C", ".*", "A+", "A*", "A?", "^GGTCTC", "GG\\dTC"]) {
      const result = validateExclusionPattern(bad);
      expect(result.ok, bad).toBe(false);
    }
  });

  it("rejects over-long patterns", () => {
    const result = validateExclusionPattern("A".repeat(MAX_EXCLUSION_PATTERN_LENGTH + 1));
    expect(result.ok).toBe(false);
    expect(validateExclusionPattern("A".repeat(MAX_EXCLUSION_PATTERN_LENGTH)).ok).toBe(true);
  });

  it("rejects commas (the storage separator)", () => {
    const result = validateExclusionPattern("GGTCTC,GAGACC");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/comma/i);
  });

  it("rejects malformed structure", () => {
    for (const bad of ["[[A]]", "A{4", "{4}A", "5A", "A]", "[A{2}]", ""]) {
      expect(validateExclusionPattern(bad).ok, bad).toBe(false);
    }
    expect(validateExclusionPattern(42).ok).toBe(false);
  });
});
