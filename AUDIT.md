# BioGrammatics Company Site — Code Audit

**Target:** `company-site/` (the codebase behind https://beta.biogrammatics.com)
**Date:** 2026-09-12 (supersedes the 2026-06-02 audit, preserved in git at `b17b01c`)
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 / PostgreSQL · NextAuth v5 · Stripe · AWS S3 · Twist / Twilio / ShipStation · background codon-optimization worker (~28k LOC incl. scripts)

**Method:** Whole-codebase review, not a diff review. Eight independent finder passes (three line-by-line correctness sweeps split by subsystem — auth/admin, commerce, codon pipeline — plus an authorization-invariant audit, a cross-file producer/consumer trace, and reuse, efficiency and root-cause passes). Every candidate that survived deduplication was independently re-verified against the source before being reported; 13 of 14 verified as confirmed, one as plausible, none refuted. The ten highest-severity findings were then fixed the same day in six themed commits (`e76d61d..9420262`) and this document records the resulting state.

**Baseline at time of writing:** `tsc --noEmit` clean · 196 tests in 19 files passing (`vitest`) · eslint 3 errors, all pre-existing in untouched files (`benchmark-optimizers.ts` ×2, `cart-context.tsx` ×1) · working tree clean on `main`.

Findings keep the stable-ID convention from the June audit (`C#` critical, `H#` high, `M#` medium, `L#` low). IDs 1–29 are the June findings; IDs 30+ are new in this review.

---

## Executive summary

Two remediation rounds have landed since June. In July (`e9c1543`, `877515b`, `8fe8fe2`, `2c06c05`, `cbb80a6`) the payment-integrity criticals were closed: all product types are persisted on the order, shipping is recomputed server-side, the Stripe webhook is payment-aware and idempotent, and a test harness was introduced. On 2026-09-12 this review closed the access-control cluster and a second layer of correctness bugs: admin Server Actions are guarded, team logins no longer inherit the owner's role, product visibility is enforced by one predicate, shipping can no longer be omitted, the codon endpoint is bounded and its worker claims jobs atomically, and admin order views show what was actually bought.

**The site is now defensible against the attacks the June audit described, but it is not yet launch-ready.** Five items still block a public launch with real payments:

1. **C4 — migrations.** Production schema is still synced by `prisma db push`, now from the web service's pre-deploy command (Render build containers cannot reach the database's internal hostname). `--accept-data-loss` is gone, so a destructive change fails the new instance and the previous release keeps serving, but the migrations directory is frozen at January and `prisma migrate deploy` has not been adopted. Needs production database access to baseline.
2. **H9 / H37 — no rate limiting** on magic-link, check-email, team invite, change-email or codon submission. Input is now validated and bounded, but unlimited outbound mail and user enumeration remain.
3. **H10 / H39 — environment provisioning.** `render.yaml` still does not declare `NEXT_PUBLIC_BASE_URL` (checkout `success_url` becomes `undefined/...`), `AWS_*`, `SHIPSTATION_API_KEY`, or the `TWIST_*` tokens the worker needs. If these are set by hand in the Render dashboard the site works; the file does not reproduce that.
4. **Public-site honesty (Codex 11, 12, 17).** Navigation links to `/subscriptions`, `/services` and `/path-to-protein` 404; the strain "Add to Cart" is an inert placeholder; privacy and cookie pages stamp today's date as "Last updated" and describe practices the code does not implement.
5. **H38 — the worker has no per-job wall-clock deadline.** The optimizer is synchronous CPU work; the new length and pattern caps bound it, but a single pathological job still blocks the queue until it finishes.

### Architecture note: authorization is centralized in helpers, not middleware

There is still no `src/proxy.ts` (Next 16's name for `middleware.ts`), and the `authorized` callback in `auth.config.ts` remains dead code. The remediation chose a different mechanism: `src/lib/auth-guards.ts` is the single definition of "who is an admin", and grep confirms it is called by all 12 admin Server Actions, all 19 admin page/layout files, and every admin and Twist API handler. This is robust as long as new routes follow the convention (see `CLAUDE.md`). A `proxy.ts` matcher on `/admin` and `/api/admin` would add defense in depth at low cost and is still recommended.

### Deploy configuration note (2026-09-12)

Editing `render.yaml` for C4 triggered the first Blueprint sync since February and exposed that the file and the dashboard had diverged: the worker used the retired `starter` plan name, the database had been upgraded to Basic-256mb, the web service had been upgraded to the $7 instance, and `DATABASE_URL` had been pointed at the external hostname so the build could run `db push`. The sync failed on the database downgrade, then briefly downgraded the web service to free, then restored the Blueprint-supplied internal `DATABASE_URL`, which the build container cannot reach. All of this is now reconciled (`ccd5289`, `793e4da`, `ff40ea7`, `814442a`): plans are declared as they actually are, and the schema sync runs as a `preDeployCommand` inside the private network. **Rule going forward:** change plans and env vars in `render.yaml`, not in the dashboard; a sync overwrites the dashboard.

### Severity legend

| Tier | Meaning |
|------|---------|
| 🔴 Critical | Revenue loss, data loss, payment integrity, or trivial unauth abuse. |
| 🟠 High | Broken access control or production breakage. |
| 🟡 Medium | Correctness / robustness / operational risk. |
| 🟢 Low | Hygiene, cleanup, hardening. |

---

## Status of the June 2026 findings

| ID | Finding | Status | Resolved in / notes |
|----|---------|--------|---------------------|
| C1 | Strain & product purchases charged but not recorded | ✅ Fixed | `e9c1543` — all three item types persisted; totals asserted |
| C2 | Shipping price trusted from client | ✅ Fixed | `e9c1543` recomputed from ShipStation; `4ffb044` closed the remaining hole where *omitting* the rate yielded $0 shipping |
| C3 | Webhook not payment-aware / not idempotent | ✅ Fixed | `877515b` — `payment_status` check, `ProcessedWebhookEvent`, transaction, refund/dispute/async-failure handlers |
| C4 | `db push --accept-data-loss` on deploy | 🟡 Partial | `9420262` — `npm run build` no longer runs `db push`; flag removed. Follow-up moved `db push` to a Render `preDeployCommand` because the build container cannot reach the internal DB hostname. **Baseline + `migrate deploy` still open** |
| C5 | Codon endpoint unbounded / ReDoS | ✅ Fixed (except throttling) | `273d351` — hard 10,000 aa cap, IUPAC-plus-bounded-quantifier pattern grammar, email required for guests, uuid ids. Rate limiting tracked as H37 |
| H6 | Team login inherits owner identity and role | ✅ Fixed | `78b289e` — Session flagged, role forced to USER, identity-changing routes reject team sessions, primary user resolved first |
| H7 | Any user can download non-public vector files | ✅ Fixed | `8fe8fe2`; `4ffb044` added the `isPublic` half of the predicate |
| H8 | Any user can list lot QC files | ✅ Fixed | `8fe8fe2`, tests in `cbb80a6` |
| H9 | No rate limiting; user enumeration | ❌ Open | See H37 |
| H10 | `NEXT_PUBLIC_BASE_URL` missing from `render.yaml` | ❌ Open | Still absent; see H39 |
| H11 | SUPER_ADMIN locked out of order/user detail | ✅ Fixed | `e0736d3` / `4ffb044` via `requireAdmin()` |
| H12 | Order status unvalidated, no transitions | ✅ Fixed | `4ffb044` — Zod enum + `ADMIN_ORDER_TRANSITIONS`; form checks `response.ok` |
| H13 | Webhook ↔ createUser race | ✅ Fixed | `877515b` upsert-in-transaction; `78b289e` made both sides agree on email case |
| H14 | No quantity validation | ✅ Fixed | `e9c1543` — positive integer ≤ 1000 |
| H15 | Uploads: no size limit, no content check; unbounded thumbnail | ❌ Open | `file.size` is stored, never checked; thumbnail still base64 in DB |
| M16 | Dangling PENDING order on Stripe failure | ❌ Open | Order still created before the Stripe call; catch does not clean up |
| M17 | No tax | ❌ Open | `taxAmount` never computed |
| M18 | Webhook ignores refunds/disputes | ✅ Fixed | `877515b` |
| M19 | State-changing GETs (accept-invite, verify-email-change) | ❌ Open | Both still mutate on GET |
| M20 | Misleading comment in verify-email-change | ✅ Fixed | `78b289e` — route now actually checks team emails |
| M21 | `notificationEmail` / `proteinName` unvalidated | ✅ Fixed | `273d351` |
| M22 | Worker claim not atomic; no stale sweep | ✅ Fixed | `273d351` — `updateMany` guarded on PENDING; 30-min stale requeue; graceful SIGTERM |
| M23 | Free-tier hosting for a transactional store | 🟡 Partial | Postgres is Basic-256mb (no point-in-time recovery); web service and worker are on 0.5c-512mb. Note: a Blueprint sync applies the plans in `render.yaml`, so they must be kept in step with dashboard changes |
| M24 | No tests; no error/not-found/loading boundaries; no robots/sitemap | 🟡 Partial | 196 tests now cover optimizer core, validation, auth guards, checkout, webhook, admin routes, team routes. **Boundaries and SEO files still absent** |
| L25 | `Math.random()` for ambiguous residues | ❌ Open | `codon-optimization.ts:268-270` |
| L26 | Unsanitized filename in `Content-Disposition` | ❌ Open | `s3.ts:38` |
| L27 | `process.env.X!` assertions, no fail-fast `env.ts` | ❌ Open | `s3.ts`, `stripe.ts` |
| L28 | `.env.example` missing `AWS_*`, `SHIPSTATION_API_KEY` | ❌ Open | Also still documents `AUTH_URL` while code reads `NEXTAUTH_URL` |
| L29 | Dead/duplicate code (otp.ts, legacy models, scripts) | ❌ Open | See L44 for the current inventory |

---

## New findings in this review

### Resolved on 2026-09-12

| ID | Finding | Commit |
|----|---------|--------|
| 🔴 **C30** | **Admin Server Actions had no auth check.** Twelve inline `"use server"` actions (create/update/delete vector, strain, lot; delete vector-file and lot-file) relied on the admin layout's redirect, which does not run before an action executes. Action IDs ship in public chunks; `createVector`/`createStrain` were callable with the ID alone and `deleteFile` took its target from form data. Every action now calls `assertAdminAction()` first; deletes are scoped to their parent; all admin pages call `requireAdminPage()` themselves. | `e0736d3` |
| 🟠 **H31** | **Admin order list/detail and both admin order APIs loaded only the legacy `items` relation**, so every vector or strain order rendered as "0 items" with an empty table under a non-zero total. Shared `orderLineInclude` / `flattenOrderLines` now used everywhere. | `4ffb044` |
| 🟠 **H32** | **Terminal `*` passed API validation but failed the worker's whitelist**, so every UniProt/FASTA-style paste produced a FAILED job. One trailing stop is stripped; internal stops are rejected with a position. | `273d351` |
| 🟠 **H33** | **Checkout and webhook stored raw mixed-case emails while auth routes lowercased**, creating a second User the customer could never log into with their paid order attached to the first. `normalizeEmail` is now used on every identity path; re-link queries match case-insensitively. | `78b289e` |
| 🟡 **M34** | **Re-inviting a revoked team email always 500'd** on `@@unique([email,userId])` because DELETE soft-revokes and POST only looked for ACTIVE/PENDING rows. Revoked rows are reactivated. | `78b289e` |
| 🟡 **M35** | **`/auth/error` read `searchParams` synchronously** (a Promise in Next 16), so every error showed the generic message; `InvalidToken`/`TokenExpired`/`EmailAlreadyInUse` had no copy at all. | `78b289e` |
| 🟡 **M36** | **Four different visibility predicates.** Vectors ignored `isPublic` (which no admin form wrote), the strain detail ignored `isAvailable`, the strain checkout branch checked neither. One `visibility.ts` module now serves catalog, detail, file and checkout paths; `Vector.isPublic` is editable. | `4ffb044`, `e0736d3` |

### Open

#### 🟠 H37 — No rate limiting on auth, email or job-submission endpoints (supersedes H9)
`send-magic-link`, `check-email`, `account/team` POST, `change-email` and `codon-optimization` POST are unthrottled. `check-email` still returns four distinguishable shapes (primary / team / pending-invite / none), so a customer list can be classified in one pass. Inputs are now validated, but unlimited outbound Resend mail to third parties remains possible.
**Fix:** per-IP and per-identifier limits (e.g. 5 sends / 15 min) via Upstash Ratelimit or Arcjet in a small `lib/rate-limit.ts`; make `check-email` return a uniform response.

#### 🟠 H38 — Worker has no per-job wall-clock deadline
`optimizeCodon` is synchronous CPU work called inline in the poll loop (`worker/codon-worker.ts`). Input caps bound the worst case, but a 10,000 aa job with 50 patterns still holds the single worker for its full duration and no `Promise.race` can interrupt synchronous code.
**Fix:** run the optimizer in a `worker_threads` Worker with `terminate()` on a deadline (e.g. 10 min); mark the job FAILED with a "timed out" reason.

#### 🟠 H39 — `render.yaml` does not declare the environment the code reads (supersedes H10)
Missing from the web service: `NEXT_PUBLIC_BASE_URL` (checkout `success_url`), `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_S3_BUCKET`, `SHIPSTATION_API_KEY`, `TWIST_*`, `TWILIO_*`. Missing from the worker service: `TWIST_AUTH_TOKEN`/`TWIST_END_USER_TOKEN`, so `getHeaders()` throws inside `scoreTwist` and every job silently records `twistScore: null`. `STRIPE_PUBLISHABLE_KEY` is declared but nothing reads it.
**Fix:** declare each as `sync: false` in `render.yaml`; add a fail-fast `lib/env.ts` (also closes L27).

#### 🟡 M40 — Exclusion patterns are comma-joined in storage, so `{m,n}` quantifiers are unsupported
The pattern grammar introduced in `273d351` rejects commas with a clear message rather than silently splitting (the pre-fix behaviour), but the project's own `exclusions.txt` uses `TAAC[ACGT]{1,19}[TC]AG`-style patterns that users cannot enter.
**Fix:** store `excludedEnzymeNames` as a JSON array (or newline-delimited) and split accordingly in the worker.

#### 🟡 M41 — `SECURITY_README.md` describes an encryption feature that does not exist
It names `src/lib/encryption.ts`, `POST /api/account/enable-encryption`, `isEncrypted`/`encryptionIV` columns and guarantees ("company cannot decrypt user data") with no implementation. Sequences are plaintext and readable by any admin.
**Fix:** delete the document or retitle it as a design proposal with an explicit "not implemented" banner.

#### 🟡 M42 — Debug tooling ships in the production admin navigation
`/admin/twist-test` (633 lines), `/admin/twilio-test`, and `api/twist/{test,config,probe,resource,vectors,constructs,constructs/describe}` are development probes; `api/twist/resource` is an admin-authenticated generic GET proxy against Twist with production credentials. `lib/twist.ts` defaults `env` to `"staging"` and the production worker relies on that default.
**Fix:** gate under `NODE_ENV !== "production"` or an `/admin/dev` group; make `env` a required argument in `lib/twist.ts`.

#### 🟡 M43 — Efficiency
- `strains/page.tsx`, `admin/vectors/page.tsx`, `admin/strains/page.tsx` fetch `thumbnailBase64` (tens of KB per row) they never render — use `select`.
- `admin/orders`, `admin/users`, `admin/vectors`, `admin/strains` lists and their APIs are unpaginated `findMany` with full relation trees.
- `admin/page.tsx` runs four independent aggregates serially after an existing `Promise.all`.
- Checkout looks up each cart line in a separate sequential round trip.
- `dp-optimizer.ts` `maxPatternLength` defaults to 100 while the longest real pattern is 26; measured 40% faster with byte-identical output at 30.
- No catalog page sets `revalidate`; every visit hits Postgres.

#### 🟡 M44 — Orphaned PENDING orders and cart cleared too early (supersedes M16)
The order row is created before the Stripe session; a Stripe failure returns 500 and leaves a PENDING order with no `stripeSessionId` that no webhook will ever expire. The client also calls `clearCart()` before the redirect, so a user who cancels on Stripe returns to an empty cart.

#### 🟢 L44 — Duplication and dead code (supersedes L29)
- `formatPrice` declared 21× and `formatDate` 13× (three different formats) — add `lib/format.ts`.
- Genetic-code table defined 4× (`beam-search-optimizer`, `dp-optimizer`, `repeat-breaker`, `codon-optimization`), `parseExclusionPatterns` 3× with differing grammars, `translateDna` 2×.
- `src/lib/otp.ts`, `product-form.tsx`, `thumbnail-upload.tsx`: zero importers. Twilio's `formatPhoneNumber`/`sendOtpCode`/`sendPhoneVerification` and three OTP Zod schemas: unused.
- Four root-level scripts (`analyze-proteins.ts`, `benchmark-optimizers.ts`, `score-calm-cav.ts`, `test-tripletcounts.ts`) hard-code `/Users/studio/...` paths and are compiled by every `next build`; ten one-off scripts in `worker/` re-implement `parseFasta` nine times while `src/lib/fasta-parser.ts` has no non-test importer.
- Legacy `Product`/`OrderItem` path is still reachable from the home page (`/products`) and `CustomProject` is still read by four account pages.

#### 🟢 L45 — Cart hydrates `localStorage` without a shape check
`cart-context.tsx:39` passes `JSON.parse(stored)` straight to state; a non-array value throws inside the root-layout provider and takes down every route until storage is cleared. Validate with Zod and discard on failure.

#### 🟢 L46 — Public-site items from the Codex review remain unchanged
Dead navigation links (Codex 11), inert strain add-to-cart (12), legal pages with a live "Last updated" date and unverifiable claims (17), no mobile navigation or reduced-motion handling (14), no SEO baseline (15). See `CODEX_ACTIONS.md` for the per-item log.

---

## What's genuinely solid (keep it this way)

- **Server-authoritative pricing and shipping.** Product prices come from the DB; shipping is quoted by the server for the submitted address and can no longer be omitted; persisted totals are asserted against Stripe line items.
- **Webhook integrity.** Signature verification on the raw body, `payment_status` gate, processed-event table, conditional state transitions, refund/dispute/async-failure handling — all inside one transaction.
- **One authorization vocabulary.** `auth-guards.ts` is called by every admin action, page and handler; team sessions can never be admin; tests cover anonymous / user / admin / super-admin / team-login for the guard and for representative routes.
- **One identity vocabulary.** `normalizeEmail` on every create/match path; case-insensitive re-linking for legacy rows.
- **One visibility vocabulary.** `visibility.ts` predicates and `PURCHASED_ORDER_STATUSES` replace copied literals.
- **Bounded scientific intake.** Length cap, pattern grammar that cannot backtrack catastrophically, sanitized names, validated notification email, unguessable job ids, atomic claims with stale recovery.
- **Deploy no longer silently destroys data**, and `npm run build` cannot touch a database.
- **Test suite exists and is fast** (196 tests, ~0.4 s), with fixtures and a documented mocking pattern.
- Unchanged from June: integer-cents money, private S3 with short-lived presigned URLs, strong random tokens, no raw SQL, strict TypeScript, clean secret hygiene, good security headers.

---

## Remediation roadmap

**Phase A — Finish production safety (blockers)**
- [ ] C4 — `pg_dump`; `prisma migrate diff --from-url $PROD --to-schema-datamodel prisma/schema.prisma --script` → baseline migration; `prisma migrate resolve --applied`; `render.yaml` `preDeployCommand` → `npx prisma migrate deploy`
- [ ] H37 — rate limiting + uniform `check-email`
- [ ] H39 — declare all env vars in `render.yaml`; add fail-fast `lib/env.ts` (closes L27)
- [ ] H38 — optimizer in a `worker_threads` Worker with a deadline
- [ ] `src/proxy.ts` matcher on `/admin`, `/api/admin`, `/api/twist` (defense in depth)

**Phase B — Correctness and robustness**
- [ ] M44 — create the Stripe session first, or delete the order on failure; clear the cart on `/checkout/success`, not before redirect
- [ ] M19 — POST + confirmation for accept-invite and verify-email-change
- [ ] H15 — upload size limits and magic-byte checks; thumbnails to S3
- [ ] M40 — JSON-array storage for exclusion patterns
- [ ] L45 — validate cart storage
- [ ] M17 — Stripe Tax

**Phase C — Public site honesty (before any marketing push)**
- [ ] Codex 11 — implement or remove `/subscriptions`, `/services`, `/path-to-protein`
- [ ] Codex 12 — wire strain add-to-cart (persistence already exists) or show "Request availability"
- [ ] Codex 17 — fixed legal revision dates; remove unverifiable claims; counsel review
- [ ] M24 remainder — `error.tsx`, `not-found.tsx`, `loading.tsx`, `sitemap.ts`, `robots.ts`; Codex 14/15

**Phase D — Cleanup**
- [ ] M41 — delete or relabel `SECURITY_README.md`
- [ ] M42 — gate debug tooling; required `env` in `lib/twist.ts`
- [ ] M43 — `select` on list pages, pagination, `Promise.all`, `maxPatternLength`, `revalidate`
- [ ] L44 — `lib/format.ts`, `lib/genetic-code.ts`, delete dead modules, move scripts out of the compiled tree
- [ ] L25, L26, L28, M23

---

## Notes on scope

This audit covers `company-site/` and the repo-root deploy configuration. It does not cover the scientific correctness of the optimizers beyond the input/validation seam (one offline-only discrepancy was noted in passing: `repeat-breaker.ts:528` counts never-active pairs as "fixed"). The public-site content findings are carried from the Codex review rather than re-derived. Severities assume the site is moving toward taking real payments.
