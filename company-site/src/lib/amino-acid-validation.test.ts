import { describe, it, expect } from "vitest";
import {
  cleanSequence,
  findInvalidCharacters,
  validateSequence,
  normalizeSequence,
  estimateMolecularWeight,
  formatMolecularWeight,
  calculateComposition,
  checkExpressionWarnings,
} from "./amino-acid-validation";

describe("cleanSequence", () => {
  it("strips whitespace and uppercases", () => {
    expect(cleanSequence("  m a\tg\n ")).toBe("MAG");
  });
  it("returns empty string for null/undefined", () => {
    expect(cleanSequence(null)).toBe("");
    expect(cleanSequence(undefined)).toBe("");
  });
});

describe("findInvalidCharacters", () => {
  it("accepts the 20 amino acids and the stop codon", () => {
    expect(findInvalidCharacters("MAGWY*")).toEqual([]);
  });
  it("flags non-amino-acid characters (deduplicated)", () => {
    expect(findInvalidCharacters("MAGZ1Z")).toEqual(["Z", "1"]);
  });
});

describe("validateSequence", () => {
  it("accepts a valid sequence", () => {
    const r = validateSequence("MAGW");
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.stats?.length).toBe(4);
  });

  it("rejects an empty sequence", () => {
    const r = validateSequence("   ");
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Sequence is empty");
  });

  it("reports invalid amino acid codes", () => {
    const r = validateSequence("MAZ");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("Z"))).toBe(true);
  });

  it("enforces requireMethionine", () => {
    const r = validateSequence("AG", { requireMethionine: true });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Must start with methionine (M)");
  });

  it("enforces requireStopCodon", () => {
    const r = validateSequence("MA", { requireStopCodon: true });
    expect(r.errors).toContain("Must end with stop codon (*)");
  });

  it("enforces minimumLength", () => {
    const r = validateSequence("M", { minimumLength: 5 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("at least 5"))).toBe(true);
  });
});

describe("normalizeSequence", () => {
  it("adds a leading M and trailing * when missing", () => {
    expect(normalizeSequence("AG")).toBe("MAG*");
  });
  it("leaves an already-normalized sequence unchanged", () => {
    expect(normalizeSequence("MAG*")).toBe("MAG*");
  });
  it("can be told not to add flanking residues", () => {
    expect(normalizeSequence("AG", false, false)).toBe("AG");
  });
});

describe("molecular weight", () => {
  it("estimates ~110 Da per residue", () => {
    expect(estimateMolecularWeight("MA")).toBe(220);
    expect(estimateMolecularWeight("")).toBeNull();
  });
  it("formats Da and kDa", () => {
    expect(formatMolecularWeight(220)).toBe("220 Da");
    expect(formatMolecularWeight(12500)).toBe("12.5 kDa");
    expect(formatMolecularWeight(null)).toBe("N/A");
  });
});

describe("calculateComposition", () => {
  it("counts each residue", () => {
    const comp = calculateComposition("MAM");
    expect(comp.get("M")).toBe(2);
    expect(comp.get("A")).toBe(1);
  });
});

describe("checkExpressionWarnings", () => {
  it("warns on long proline runs", () => {
    const warnings = checkExpressionWarnings("MPPPPA");
    expect(warnings.some((w) => w.toLowerCase().includes("proline"))).toBe(true);
  });
  it("returns no warnings for a benign sequence", () => {
    expect(checkExpressionWarnings("MAGT")).toEqual([]);
  });
});
