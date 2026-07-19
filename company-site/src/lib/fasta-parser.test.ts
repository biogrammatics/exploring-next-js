import { describe, it, expect } from "vitest";
import { parseFasta, generateSampleFasta } from "./fasta-parser";

describe("parseFasta", () => {
  it("parses the built-in two-record sample", () => {
    const r = parseFasta(generateSampleFasta());
    expect(r.success).toBe(true);
    expect(r.proteins).toHaveLength(2);
    expect(r.proteins[0].name).toBe("GFP");
    expect(r.proteins[0].description).toBe("Green Fluorescent Protein");
    expect(r.proteins[1].name).toBe("mCherry");
    // sequenceOrder is 1-based and preserved
    expect(r.proteins.map((p) => p.sequenceOrder)).toEqual([1, 2]);
  });

  it("errors on empty input", () => {
    const r = parseFasta("   ");
    expect(r.success).toBe(false);
    expect(r.errors).toContain("File is empty");
  });

  it("errors when there is no FASTA header", () => {
    const r = parseFasta("MAGWY");
    expect(r.success).toBe(false);
    expect(r.errors.some((e) => e.includes("FASTA"))).toBe(true);
  });

  it("parses the [bracketed] description format", () => {
    const r = parseFasta(">seq1 [my description]\nMAGG*\n");
    expect(r.proteins[0].name).toBe("seq1");
    expect(r.proteins[0].description).toBe("my description");
  });

  it("parses the space-separated description format", () => {
    const r = parseFasta(">seq1 some free text\nMAGG*\n");
    expect(r.proteins[0].description).toBe("some free text");
  });

  it("accumulates a sequence split across multiple lines", () => {
    const r = parseFasta(">s\nMAG\nGAT\nMAG*\n");
    expect(r.proteins[0].aminoAcidSequence).toBe("MAGGATMAG*");
  });

  it("auto-adds M and * and records warnings", () => {
    const r = parseFasta(">s\nAGGA\n");
    expect(r.proteins[0].aminoAcidSequence).toBe("MAGGA*");
    expect(r.warnings.some((w) => w.includes("methionine"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("stop codon"))).toBe(true);
  });

  it("strips non-amino-acid characters from the sequence", () => {
    const r = parseFasta(">s\nMA123GG*\n");
    expect(r.proteins[0].aminoAcidSequence).toBe("MAGG*");
  });

  it("errors on a sequence that is too short after normalization", () => {
    const r = parseFasta(">s\nM\n");
    expect(r.success).toBe(false);
    expect(r.errors.some((e) => e.includes("too short"))).toBe(true);
  });
});
