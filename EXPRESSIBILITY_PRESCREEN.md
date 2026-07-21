# Pichia Expressibility Pre-Screen — Work Synopsis

_Date: 2026-07-21_

## Goal

Give a prospective customer an **advisory report** on whether their protein is
likely to express well in _Pichia pastoris_ — not a definitive verdict, but a
"look at these potential problems more carefully before proceeding" screen
(e.g. repeat domains that complicate DNA synthesis, transmembrane domains that
preclude secretion, internal protease sites that clip the product).

## How we got here (decision trail)

We explored three ways to characterize a protein and picked the one that fits
the product goal and the existing stack:

1. **CaLM + Pichia-derived CAVs** (from the `reverse-translation-optimization`
   research repo). Learned codon-embedding probes for traits (TMD, Pfam
   domains, expression, synthesizability). Powerful, but:
   - Python/PyTorch — a foreign runtime to this Node/Next.js app.
   - Would need a **separate Render service** (~2 GB RAM, ~$25/mo) just to serve
     an advisory report — disproportionate.
   - Trait calls are _inferences_ ("looks like…"), and depend on codon encoding.

2. **Classical annotation tools** (HMMER/Pfam via `pyhmmer`, `tmhmm.py`, etc.).
   Authoritative, but still Python, and Pfam adds ~1.5 GB of data.

3. **A lightweight rules engine in TypeScript** — chosen. Most red flags that
   matter for Pichia are cheap sequence heuristics (regex/counting), and the
   worker **already** fetches Twist synthesizability scores, which cover the
   DNA-synthesis-complexity flags authoritatively.

**Decision:** implement the report as pure TypeScript inside the existing codon
worker. **No Python, no CaLM, no new service, no instance upgrade — $0 added
infra.** CaLM/CAV is parked as a possible future premium "learned expressibility
score" delivered via a separate Python service over HTTP, only if it proves to
add value beyond the rules + Twist.

### Key scoping fact

BioGrammatics vectors carry **no built-in secretion signal** — the secretion
leader is added to the ORF as a separate step (not yet in the website). So the
report **assumes a secreted strategy**, which drives the severity of the
secretory-pathway flags (Kex2, N-glycosylation).

## What was built

- **`company-site/src/lib/expressibility-report.ts`** — pure, dependency-free.
  `generateExpressibilityReport(proteinSequence, { dnaSequence?, twist? })`
  returns a typed, severity-ranked `ExpressibilityReport`.
- **`company-site/worker/test-expressibility-report.ts`** — `tsx` demo with
  sequences that exercise every flag. Run:
  `cd company-site && npx tsx worker/test-expressibility-report.ts`

### Flags implemented (all under the secreted assumption)

| Flag | Method | Severity logic |
|---|---|---|
| Transmembrane domains | Kyte-Doolittle hydrophobicity window | ≥2 → blocker; 1 internal → caution; 1 N-terminal → caution ("possible native signal/anchor") |
| Internal Kex2 sites (KR/RR) | regex | caution, with positions |
| N-glycosylation sequons (N-X-[S/T]) | regex | note (caution if ≥5) |
| Cysteine load | count | caution if ≥8; note if odd & ≥3; lone Cys ignored |
| Size | length | note >600 aa, caution >1000 aa; reports ~kDa |
| C-terminal HDEL/KDEL | suffix match | caution (ER-retention) |
| Low-complexity / homopolymer runs | run scan | caution, with residue + position |
| DNA synthesis | existing Twist `difficulty`/`errors` | COMPLEX → caution; NOT ACCEPTED/UNBUILDABLE → blocker |

Each flag carries a **finding / rationale / recommendation** triple, and the
report rolls up to an overall `clear` / `review` / `high-risk`. A `metrics`
block gives an at-a-glance profile (length, kDa, Cys, TM, N-glyc, Kex2).

### Honest limitations (consistent with "advisory, not definitive")

- TM prediction is a hydrophobicity **heuristic**, not DeepTMHMM — catches clear
  membrane proteins, may miss marginal helices or over-call hydrophobic soluble
  stretches.
- Kex2 and N-glyc are **motif scans**; real usage depends on structure and
  accessibility. Deliberately conservative.

## Status

- Logic + test only. **Nothing wired into the schema, worker, or UI yet.**
- New files typecheck clean against the project `tsconfig`.

## Next steps (to make it customer-facing)

1. **Schema:** add `expressibilityReport Json?` to `CodonOptimizationJob`
   (one Prisma migration).
2. **Worker:** call `generateExpressibilityReport(job.proteinSequence,
   { dnaSequence, twist })` right after `scoreTwist` in `processJob`; store it.
3. **UI + email:** render the severity-coded report on the results page and fold
   a one-line summary into the completion email.

### Validation to do

Run real customer sequences with **known expression outcomes** through the
report to calibrate thresholds before surfacing it.

## Related

- Research repo: `reverse-translation-optimization` (CaLM, CAVs, beam-search
  optimizer, transcriptome analysis) — the source of the parked CaLM/CAV option.
