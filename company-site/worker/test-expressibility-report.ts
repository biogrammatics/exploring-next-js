/**
 * Test / demo for the Pichia expressibility pre-screen.
 * Run: npx tsx worker/test-expressibility-report.ts
 *
 * Uses hand-built sequences that trigger each flag, so the output can be
 * eyeballed before wiring the report into the worker / results page / email.
 */

import {
  generateExpressibilityReport,
  type ExpressibilityReport,
  type FlagSeverity,
} from "../src/lib/expressibility-report";

const ICON: Record<FlagSeverity, string> = {
  blocker: "🔴",
  caution: "🟡",
  note: "🟢",
};

function printReport(name: string, report: ExpressibilityReport): void {
  console.log("\n" + "=".repeat(72));
  console.log(`${name}`);
  console.log("=".repeat(72));
  const m = report.metrics;
  console.log(
    `  ${report.metrics.lengthAa} aa · ~${m.molecularWeightKda} kDa · ` +
      `${m.cysteineCount} Cys · ${m.predictedTmSegments} TM · ` +
      `${m.nGlycSequons} N-glyc · ${m.kex2Sites} Kex2`
  );
  console.log(
    `  Overall: ${report.summary.overall.toUpperCase()}  ` +
      `(${report.summary.blockers} blocker, ${report.summary.cautions} caution, ${report.summary.notes} note)`
  );
  if (report.flags.length === 0) {
    console.log("  No flags — looks clear for secreted expression.");
    return;
  }
  for (const f of report.flags) {
    console.log(`\n  ${ICON[f.severity]} [${f.severity}] ${f.title}`);
    console.log(`     Finding: ${f.finding}`);
    console.log(`     Why:     ${f.rationale}`);
    console.log(`     Do:      ${f.recommendation}`);
  }
}

// A benign, soluble-looking small protein (GFP-ish fragment, no red flags).
const CLEAN =
  "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTT";

// Membrane protein: two long hydrophobic stretches → polytopic → blocker.
const MEMBRANE =
  "MSTABC" +
  "LVLLVLLVLLIVLLVLLVLLA" + // TM1
  "GSDEKRNGTPQESDGHKLMNPQRS" + // loop (note: contains KR + NGT sequon)
  "FLIIVLLFLLVLLFLLVLLFLL" + // TM2
  "GSKKQPTAENDR";

// Secreted candidate with internal Kex2 sites + N-glyc + odd Cys + HDEL end.
const SECRETORY_ISSUES =
  "MKFLSLLTAVSANFTGENLYFQSGGKRGGSGGRRGGSGNITGGSGGCGGSGGSGKDEL"; // ends KDEL

// Homopolymer / low-complexity runs.
const LOWCOMPLEXITY = "MGSAAAAAAAAGSQQQQQQQQQGSLLLLLLLLGS";

function main(): void {
  printReport("1. Clean small protein (expect: clear)", generateExpressibilityReport(CLEAN));

  printReport(
    "2. Membrane protein (expect: TM blocker + incidental flags)",
    generateExpressibilityReport(MEMBRANE)
  );

  printReport(
    "3. Secretory candidate w/ Kex2 + N-glyc + HDEL (expect: multiple cautions)",
    generateExpressibilityReport(SECRETORY_ISSUES)
  );

  printReport(
    "4. Low-complexity runs (expect: low-complexity caution)",
    generateExpressibilityReport(LOWCOMPLEXITY)
  );

  printReport(
    "5. Clean protein but Twist rated COMPLEX (expect: synthesis caution)",
    generateExpressibilityReport(CLEAN, {
      twist: {
        twistScore: "BUILDABLE",
        twistDifficulty: "COMPLEX",
        twistErrors: JSON.stringify([
          { message: "High GC region near position 120" },
          { message: "Repeat detected" },
        ]),
      },
    })
  );

  console.log("\n" + "=".repeat(72));
  console.log("Done. Review flags above.");
  console.log("=".repeat(72));
}

main();
