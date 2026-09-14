import { describe, it, expect } from "vitest";
import {
  validateProteinSequence,
  validateExclusionPattern,
  MAX_PROTEIN_LENGTH,
  MAX_EXCLUSION_PATTERN_LENGTH,
} from "./codon-optimization";

describe("validateProteinSequence", () => {
  it("accepts the 20 standard amino acids in any case with whitespace and line breaks", () => {
    const result = validateProteinSequence("mkv lw\n ACDEFGHIKLMNPQRSTVWY \t\n");
    expect(result.isValid).toBe(true);
    expect(result.cleanedSequence).toBe("MKVLWACDEFGHIKLMNPQRSTVWY");
    expect(result.errors).toEqual([]);
  });

  it("strips exactly one trailing stop codon", () => {
    const result = validateProteinSequence("MKVLW*");
    expect(result.isValid).toBe(true);
    expect(result.cleanedSequence).toBe("MKVLW");
    expect(result.length).toBe(5);
  });

  it("rejects an internal stop codon with its 1-based position", () => {
    const result = validateProteinSequence("MK*VLW");
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/stop \(\*\) is only allowed as the final character.*position 3/);
  });

  it("rejects two trailing stop codons (the second is internal after stripping)", () => {
    expect(validateProteinSequence("MKVLW**").isValid).toBe(false);
  });

  it("accepts and returns a leading FASTA header", () => {
    const result = validateProteinSequence(">sp|P12345 My protein OS=Homo sapiens\nMKVLW*\n");
    expect(result.isValid).toBe(true);
    expect(result.cleanedSequence).toBe("MKVLW");
    expect(result.fastaHeader).toBe("sp|P12345 My protein OS=Homo sapiens");
  });

  it("rejects digits (line numbers) and explains how to fix it", () => {
    const result = validateProteinSequence("1 MKVLW\n61 ACDEF");
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /Digits are not amino acids/.test(e))).toBe(true);
    expect(result.errors.some((e) => /Remove line numbers/.test(e))).toBe(true);
  });

  it.each([
    ["X", /unknown residue/],
    ["B", /Asp or Asn/],
    ["Z", /Glu or Gln/],
    ["J", /Leu or Ile/],
    ["U", /selenocysteine/],
    ["O", /pyrrolysine/],
  ])("rejects ambiguity/rare code %s with a specific explanation instead of substituting", (code, re) => {
    const result = validateProteinSequence(`MK${code}VLW`);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(re);
    expect(result.errors[0]).toMatch(/position 3/);
  });

  it("names any other symbol and where it occurs, grouping repeats", () => {
    const result = validateProteinSequence("MK-VL-W-A-C-D-E");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(/"-" is not an amino acid code/);
    expect(result.errors[0]).toMatch(/positions 3, 6, 8, 10, 12 and 1 more/);
  });

  it("reports each distinct offending character once", () => {
    const result = validateProteinSequence("MXKX1B");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(3); // X, 1, B
  });

  it("rejects sequences above 2,500 aa and points the client to a custom project", () => {
    const result = validateProteinSequence("A".repeat(MAX_PROTEIN_LENGTH + 1));
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/2,501 aa/);
    expect(result.errors[0]).toMatch(/up to 2,500 aa/);
    expect(result.errors[0]).toMatch(/Twist.*7 kb/);
    expect(result.errors[0]).toMatch(/custom project/);
  });

  it("accepts a sequence of exactly MAX_PROTEIN_LENGTH", () => {
    const result = validateProteinSequence("A".repeat(MAX_PROTEIN_LENGTH));
    expect(result.isValid).toBe(true);
    expect(MAX_PROTEIN_LENGTH).toBe(2500);
  });

  it("rejects an empty sequence with guidance", () => {
    expect(validateProteinSequence("  \n").isValid).toBe(false);
    expect(validateProteinSequence("*").isValid).toBe(false);
    expect(validateProteinSequence(">only a header\n").errors[0]).toMatch(/No amino acids found/);
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
