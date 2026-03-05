# Twist Bioscience API Integration

## Overview

Integration with Twist Bioscience's staging API for scoring DNA sequence synthesizability.
Used to evaluate codon-optimized sequences before ordering synthesis.

**API Base URL:** `https://twist-api.twistbioscience-staging.com`
**Account:** `twist.sandbox@biogrammatics.com`
**Auth:** Two headers required — `Authorization: JWT <token>` and `X-End-User-Token: <token>`
**IP Whitelist:** API calls must go through Render server-side routes (Twist whitelists Render's IPs)

## API Flow

### 3-Step Process

1. **GET vectors** — `/v1/users/{email}/vectors/` — Fetch available vectors and insertion points
2. **POST constructs** — `/v1/users/{email}/constructs/` — Create a construct for scoring
3. **GET constructs/describe** — `/v1/users/{email}/constructs/describe/?id__in={id}` — Score the construct

### Two Construct Types

#### Cloned Gene (`CLONED_GENE`)
- Requires `vector_mes_uid` and `insertion_point_mes_uid`
- Twist uses ~60bp of vector sequence flanking the insertion point as synthesis adapters
- These adapters are scored alongside the insert — can cause adapter-insert homology conflicts (error 4505)

#### Fragment (`NON_CLONED_GENE`)
- No vector required — just the raw DNA sequence
- Twist uses short generic adapters (~23bp) for synthesis
- Gives the "true" synthesizability score of the sequence itself, without vector context

## Scoring Results

### Score Field
- `BUILDABLE` — Sequence can be synthesized
- `UNBUILDABLE` — Sequence cannot be synthesized via API

### Difficulty Field
- `STANDARD` — No issues
- `COMPLEX` — Synthesizable but flagged as higher risk (only appears with `BUILDABLE` score)
- `NOT ACCEPTED` — Rejected (appears with `UNBUILDABLE` score)

### Key Finding: Three-Tier Scoring
The API does support a COMPLEX tier (score=BUILDABLE, difficulty=COMPLEX), but it only
appears when there are no ERROR-severity issues. Any ERROR-severity issue (like adapter
conflict 4505) forces the result to UNBUILDABLE / NOT ACCEPTED.

### Website vs API Scoring Differences
- The Twist website is more permissive — it shows COMPLEX sequences with a price and allows ordering
- The API hard-rejects on ERROR-severity issues that the website tolerates
- This is likely a business decision: API orders tend to be high-volume batch orders where
  synthesis failures at scale are costly, so the threshold is stricter
- The website handles one-off orders where Twist absorbs the risk of individual failures

### Model Prediction Thresholds
- `upper_model_threshold`: 0.96 (above = STANDARD)
- `lower_model_threshold`: 0.69 (below = likely NOT ACCEPTED)
- Between 0.69 and 0.96 = COMPLEX territory

## Adapter Behavior (Critical Discovery)

### For Cloned Genes
The "adapters" are NOT separate Twist synthesis sequences — they are the vector's own DNA
sequence flanking the insertion point (~60bp on each side). Twist pulls this directly from
the vector you specify.

**Example with catalog pTwist PIC9:**
- start_adapter: `AGCGTGACCCTGTGTAGTTCGGAGGGGTATCTCTCGAGAAAAGAGAGGCTGAAGCTTACGTA`
  - Contains XhoI site (CTCGAG) — common Pichia cloning site
- end_adapter: `GCGGCCGCGAATTAATTCGCCTTAGACATGACTGTTCCTCCGCTCTTAGGGAACACGATGGCTT`
  - Starts with NotI site (GCGGCCGC) — common Pichia cloning site

### For Fragments
Uses Twist's generic short adapters (~23bp), unrelated to any vector:
- start_adapter: `CTCCTAGAAACCAACTGCCCGAGA`
- end_adapter: `TGGATGGAATCGGCGGTCAACATT`

### PIC9 Adapter Conflict
The catalog PIC9 vector's long flanking sequences share partial homology with Pichia-optimized
codon patterns (high frequency of CTG, GAG, AAG, GCT codons). This triggers error 4505
("Sequence issue in the adapter") on virtually all Pichia-optimized sequences, even those
with model predictions well above the lower threshold.

**Test Results (3 borderline COMPLEX sequences via cloned gene vs fragment):**

| Sequence | Model Score | Cloned Gene Result | Fragment Result |
|----------|------------|-------------------|-----------------|
| opt030   | 0.755      | NOT ACCEPTED (4505 adapter ERROR) | — |
| opt056   | 0.671      | NOT ACCEPTED (4505 adapter ERROR) | — |
| opt086   | 0.838      | NOT ACCEPTED (4505 adapter ERROR) | BUILDABLE (COMPLEX) |

opt086 scored 0.838 (well above 0.69 threshold) and was BUILDABLE as a fragment but
NOT ACCEPTED as a cloned gene — solely due to the adapter conflict.

### Implication
Loading BioGrammatics' actual proprietary vectors into the Twist account will produce
different adapter sequences (based on the actual vector flanking regions). The adapter
conflict may or may not exist with those vectors depending on the flanking sequences.

## Error Codes

Full error code reference is in `src/lib/twist.ts` as `TWIST_ERROR_CODES`.

### Categories
- **repeats** (4300s) — Fixable via codon re-optimization (vary codon usage)
- **gc** (4200s) — Fixable via codon re-optimization (adjust GC balance)
- **codons** (4500s) — Fixable via codon re-optimization (His tags, CpG, homopolymers)
- **length** (4100s) — Sequence too short/long, consider splitting
- **design** (4400s) — Manufacturing constraints, mostly not fixable
- **forbidden** (4504-4507) — Impermissible sequences, not fixable
- **validation** (4003-4004) — Invalid input

### Severity Levels
- `WARN` — Flagged but does not auto-reject (contributes to COMPLEX difficulty)
- `ERROR` — Auto-rejects the construct as NOT ACCEPTED

## Files

- `src/lib/twist.ts` — API client library (auth, construct creation, scoring, error codes)
- `src/app/api/twist/test/route.ts` — Admin route: test connectivity
- `src/app/api/twist/vectors/route.ts` — Admin route: fetch vectors
- `src/app/api/twist/constructs/route.ts` — Admin route: create constructs (cloned or fragment)
- `src/app/api/twist/constructs/describe/route.ts` — Admin route: score constructs
- `src/app/admin/twist-test/page.tsx` — Admin test page with toggle for cloned gene vs fragment

## Environment Variables

```
TWIST_API_BASE_URL=https://twist-api.twistbioscience-staging.com
TWIST_API_EMAIL=twist.sandbox@biogrammatics.com
TWIST_AUTH_TOKEN=JWT eyJ...
TWIST_END_USER_TOKEN=eyJ...
```

Note: `TWIST_AUTH_TOKEN` needs the `JWT ` prefix. `TWIST_END_USER_TOKEN` is just the raw token.

## Next Steps

- [ ] Load BioGrammatics' actual vectors into the `twist.sandbox@biogrammatics.com` account
- [ ] Test cloned gene scoring with BioGrammatics vectors to see if adapter conflict persists
- [ ] Store BioGrammatics vector UIDs (vector_mes_uid, insertion_point_mes_uid) in the website database
- [ ] Integrate fragment scoring into the codon optimization output pipeline
- [ ] If BioGrammatics vectors don't have adapter conflicts, switch to cloned gene scoring
- [ ] Consider using `adapters_on: true` with BioGrammatics vectors to test if it changes behavior
- [ ] Production API credentials (currently using staging)

## Pichia Vectors Available on Twist (Catalog)

These are Twist's catalog versions — BioGrammatics will load their own proprietary vectors:

| Vector | Vector MES UID | Insertion Point MES UID |
|--------|---------------|------------------------|
| pTwist PIC9 | `VEC_68a4e99691216c000a3739e7` | `494e5353-68a4-e9b2-9121-6c000a3739ee` |
| pTwist PICZα | (from vectors endpoint) | (from vectors endpoint) |
| pTwist PIC9K | (from vectors endpoint) | (from vectors endpoint) |
