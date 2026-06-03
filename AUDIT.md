# BioGrammatics Company Site — Code Audit

**Target:** `company-site/` (the codebase behind https://beta.biogrammatics.com)
**Date:** 2026-06-02
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 / PostgreSQL · NextAuth v5 · Stripe · AWS S3 · Twist / Twilio / ShipStation · background codon-optimization worker (~21k LOC)

**Method:** Manual review of the security- and money-critical paths, plus six parallel deep-dive passes (auth/authorization, payments/order integrity, file access/S3, input validation/injection, data model/transactions, code quality/config). Every Critical finding was verified directly against the source. This report is a working document for remediation — findings carry a stable ID (`C#`, `H#`, `M#`, `L#`) so they can be referenced in issues and commits.

---

## Executive summary

The fundamentals are strong: strict TypeScript with zero `any`/`@ts-ignore`, clean secret hygiene (nothing committed), **server-authoritative product pricing**, verified Stripe webhook signatures, integer-cents money math, private S3 with short-lived presigned URLs, thoughtful Prisma cascades, and good security headers.

However, the site is **not yet safe to take real payments or onboard real customers.** There is a cluster of revenue-loss, data-loss, and broken-access-control issues (below), plus one architectural gap that undermines the whole auth model.

### The root architectural issue: no `middleware.ts`

There is **no `middleware.ts`** anywhere in the project. The `authorized` callback in `company-site/src/lib/auth.config.ts:21` that is *meant* to gate `/admin` and `/account` is therefore **dead code** — in NextAuth v5 that callback only executes when wired up as middleware. Consequently **every route is protected only by its own inline check**, and several routes have gaps (see H6–H8, H11). Adding a `middleware.ts` baseline gate, plus a single shared `requireAdmin()` helper, closes a large fraction of the access-control findings at once.

### Severity legend

| Tier | Meaning |
|------|---------|
| 🔴 Critical | Revenue loss, data loss, payment integrity, or trivial unauth abuse. Fix before processing real payments. |
| 🟠 High | Broken access control or production breakage. Fix before public launch. |
| 🟡 Medium | Correctness / robustness / operational risk. |
| 🟢 Low | Hygiene, cleanup, hardening. |

---

## 🔴 Critical

### C1 — Strain & generic-product purchases are charged but never recorded on the order
**Location:** `company-site/src/app/api/checkout/route.ts:112-166` (charged) vs `:203-209` (only `vectorOrderItems` persisted)
**What:** The strain and generic-`Product` branches build Stripe line items and add to the subtotal, but only `vectorItems` are written to the order. `prisma.strainOrderItem.create` and `prisma.orderItem.create` exist **nowhere** in the codebase, and the webhook never backfills them.
**Impact:** The customer is charged, but the order has **no record of what they bought** for non-vector items. The account dashboard derives "purchased strains" from `StrainOrderItem`, so a strain buyer sees nothing and can even be denied access to the product they paid for. The generic-Product path is reachable today (`company-site/src/app/products/[id]/add-to-cart-button.tsx`); the strain path is latent (no add-to-cart UI yet).
**Fix:** Collect `strainItems` and `productItems` exactly like `vectorItems` and create `strainOrderItems` / `items` in the same `order.create`. Add the missing availability gating to the strain branch while you're there (see H-note).

### C2 — Shipping price is taken from the client and trusted
**Location:** `company-site/src/app/api/checkout/route.ts:169-191`
**What:** `shippingRate.costCents` comes straight from the request body and is used as both the Stripe line-item amount and the stored `order.shippingCost`. It is never re-validated against `company-site/src/app/api/shipping/rates/route.ts`.
**Impact:** A user editing the POST body can set shipping to `$0` (or skip it). Direct revenue loss on every order. (Product prices are correctly looked up server-side — shipping is the one client-controlled price.)
**Fix:** On the server, re-call the rate provider for the submitted address, re-run the same filter/handling-fee pipeline, find the rate matching the submitted `serviceCode`, and use that server-computed cost. Reject if no match.

### C3 — Webhook marks orders PAID without confirming payment, and is not idempotent
**Location:** `company-site/src/app/api/webhooks/stripe/route.ts:28-82`
**What:** On `checkout.session.completed` it sets `status: "PAID"` without checking `session.payment_status === "paid"`, and with no dedup guard. Stripe delivers events at-least-once; a replay re-runs the whole block (including the user-creation path, which can throw — see H13).
**Fix:** Guard the transition with `updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID' } })` and treat `count === 0` as already-processed; verify `payment_status === 'paid'`; optionally persist `event.id` in a processed-events table.

### C4 — `prisma db push --accept-data-loss` runs on every production deploy
**Location:** `render.yaml:13`, `company-site/package.json:7`
**What:** The deploy syncs the schema with `db push` (the `--accept-data-loss` flag is in `render.yaml`), bypassing the stale `company-site/prisma/migrations/` folder. The schema has grown substantially with no corresponding migrations.
**Impact:** The next time a model is removed from `schema.prisma` (e.g. the dead `CustomProject` — see L-cleanup), the deploy will **silently DROP those tables and their rows** on the free-tier Postgres, which has no automated backups. One careless schema edit destroys production data.
**Fix:** Switch production to `prisma migrate deploy`; generate real migrations with `prisma migrate dev` locally; remove `--accept-data-loss`. Baseline the current prod schema into a migration first (`prisma migrate diff` + `migrate resolve`). Take a `pg_dump` before each deploy until migrations are adopted.

### C5 — Codon-optimization endpoint is an unauthenticated, unbounded DoS / cost amplifier
**Location:** `company-site/src/app/api/codon-optimization/route.ts:10-77`; worker `company-site/worker/codon-worker.ts`; ReDoS sink `company-site/src/lib/dp-optimizer.ts:244`
**What:** The POST accepts anonymous requests (`userId: session?.user?.id || null`) with **no rate limit and no sequence-length cap**. Jobs are processed by a single serial worker with **no per-job timeout**. Worse, `excludedPatterns` from the body is passed straight into `new RegExp(...)` inside the optimizer's innermost loop — a catastrophic-backtracking (ReDoS) primitive.
**Impact:** Any anonymous user can flood the queue or pin the worker indefinitely with one crafted request, blocking all legitimate jobs and burning Twist API + Resend quota (real money).
**Fix:** Require auth or a strict per-IP/per-email rate limit on the POST; reject `proteinSequence` over a hard cap (e.g. 5,000 aa) *before* the DB insert; restrict `excludedPatterns` to a DNA/IUPAC charset (or run them under a linear-time regex engine / per-pattern timeout); add a wall-clock timeout per job in the worker and mark over-runs `FAILED`.

---

## 🟠 High

### H6 — Team-email login silently adopts the account owner's identity *and role*
**Location:** `company-site/src/app/api/auth/verify-magic-link/route.ts:73-114`, with role read at `company-site/src/lib/auth.ts:31`
**What:** A team email resolves to `authorizedEmail.user` (the owner), and the session's `role` is read from that owner row. The route also hand-rolls the session cookie directly, bypassing NextAuth's CSRF protections; magic-link tokens live 24h, sessions 30 days.
**Impact:** If a team email is added to an admin's account, that team member logs in **as an admin**. There is no distinction between owner and team-member sessions — privilege escalation by design.
**Fix:** Give team-member sessions a distinct identity and enforce least privilege; never let a team email inherit an admin role. Prefer NextAuth's built-in email provider over the hand-rolled route, or add CSRF protection and shorten token life.

### H7 — Any logged-in user can download files for non-public vectors
**Location:** `company-site/src/app/api/admin/files/[fileId]/download/route.ts:33-39`
**What:** The VectorFile branch only checks `session?.user` (not admin) for products whose `productStatus.isAvailable` is false. Access is keyed on the file CUID alone.
**Impact:** Any free account can download SnapGene maps / GenBank / FASTA / product sheets for unreleased or withheld products by guessing/iterating file IDs.
**Fix:** For non-public files require ADMIN/SUPER_ADMIN (mirror the lot-file branch), or an explicit entitlement check. Keep the public branch as the only unauthenticated path.

### H8 — Any logged-in user can list lot QC/COA/sequencing files (IDOR)
**Location:** `company-site/src/app/api/admin/vectors/[id]/lots/[lotId]/files/route.ts:97-111`
**What:** The GET checks only `session?.user` while the sibling POST correctly requires admin.
**Impact:** Confidential manufacturing/QC data (file names, types, S3 keys for QC_REPORT/COA/SEQUENCING_DATA) leaks to any customer.
**Fix:** Require ADMIN/SUPER_ADMIN in the GET, matching the rest of `/api/admin/*`.

### H9 — No rate limiting on any auth / email endpoint; user enumeration
**Location:** `company-site/src/app/api/auth/send-magic-link/route.ts`, `.../check-email/route.ts`, `company-site/src/app/api/account/team/route.ts`, `.../change-email/route.ts`
**What:** All send Resend mail / mint tokens on demand with no throttle. `check-email` returns distinct responses for primary / team / pending-invite / none.
**Impact:** Mail-bomb arbitrary third-party addresses (cost + domain reputation), brute force, and harvest which emails are customers/admins.
**Fix:** Per-IP + per-identifier rate limits (e.g. 3–5 sends / 15 min); return a uniform response from `check-email`.

### H10 — `NEXT_PUBLIC_BASE_URL` is undefined in production → checkout redirects break
**Location:** `company-site/src/app/api/checkout/route.ts:218-219`; absent from `render.yaml`
**What:** `success_url`/`cancel_url` interpolate `process.env.NEXT_PUBLIC_BASE_URL`, which is only in `.env.example` (localhost) and **not provisioned in `render.yaml`**. In prod it resolves to `"undefined/checkout/success?..."`.
**Impact:** Stripe rejects the invalid `success_url` → checkout 500s, unless the var is set manually in the Render dashboard out-of-band.
**Fix:** Add `NEXT_PUBLIC_BASE_URL: https://beta.biogrammatics.com` to `render.yaml`, or derive the base URL from the request origin / `NEXTAUTH_URL` server-side.

### H11 — SUPER_ADMIN is locked out of order & user management (inconsistent authz)
**Location:** `company-site/src/app/api/admin/orders/[id]/route.ts` and `company-site/src/app/api/admin/users/[id]/route.ts` use `role !== "ADMIN"`
**What:** These reject SUPER_ADMIN, while other routes use the `["ADMIN","SUPER_ADMIN"]` allowlist. Authz is duplicated across ~13 handlers with at least two different code paths.
**Fix:** Extract one `requireAdmin()` / `requireRole([...])` helper and call it in every admin handler.

### H12 — Order status accepts any value with no transition guard
**Location:** admin order PATCH (`company-site/src/app/api/admin/orders/[id]/route.ts`) + `company-site/src/app/admin/orders/[id]/order-status-form.tsx`
**What:** An unvalidated `status` string is spread into `order.update`. A `CANCELLED` order can be set back to `PAID`, a `DELIVERED` order un-shipped, and an invalid enum value 500s.
**Fix:** Validate against the `OrderStatus` enum (Zod) and enforce a transition matrix (terminal states can't be reopened; no skipping backward).

### H13 — Webhook ↔ NextAuth `createUser` race on guest email
**Location:** `company-site/src/app/api/webhooks/stripe/route.ts:41-69` and `company-site/src/lib/auth.ts:38-48`
**What:** Both paths create a `User` and link orders by `customerEmail` with no transaction. Concurrent execution → P2002 unique-constraint 500, and the order can be left `PENDING`.
**Fix:** Use an idempotent `upsert` on `email` inside a `$transaction`; have both paths share one helper.

### H14 — No quantity validation in checkout
**Location:** `company-site/src/app/api/checkout/route.ts:71-166`
**What:** `item.quantity` (negative / zero / fractional / huge) is trusted in the subtotal math and persisted. Stripe rejects non-positive line quantities, but a negative subtotal can still be stored, and the cents math can be corrupted.
**Fix:** Validate each quantity: `Number.isInteger(q) && q > 0 && q <= MAX`. Re-assert `subtotal === Σ(lineItems)` and `total === subtotal + shipping`.

### H15 — Upload routes have no size limit and no content-type allowlist
**Location:** `company-site/src/app/api/admin/vectors/[id]/files/route.ts`, `.../lots/[lotId]/files/route.ts`, `company-site/src/app/api/admin/vectors/image/route.ts`
**What:** Each does `await file.arrayBuffer()` → `Buffer.from(...)` with no `file.size` check (no `bodySizeLimit` configured), and validates only the `fileType` enum label, not the bytes. Separately, `Vector.thumbnailBase64` is written unbounded (server action does no length/format check) and inlined into every catalog page render.
**Impact:** A multi-GB upload OOMs the server; arbitrary content can be stored under any file-type label; a huge thumbnail bloats every page. Admin-gated, which mitigates — but admin is a magic-link role.
**Fix:** Reject `file.size` over a threshold (e.g. 50 MB); validate real content type (magic bytes) against an allowlist; cap and format-check `thumbnailBase64` (or move thumbnails to S3).

---

## 🟡 Medium

- **M16 — Dangling PENDING orders on Stripe failure.** The order row is created before the Stripe call (`company-site/src/app/api/checkout/route.ts:186`); a Stripe error orphans it. Delete-on-failure, or create the order after Stripe succeeds. Add a sweep for old PENDING orders with null `stripeSessionId`.
- **M17 — No tax.** `Order.taxAmount` exists but is never computed or charged; a CA seller collects no in-state sales tax. Enable Stripe Tax (`automatic_tax`) or compute server-side.
- **M18 — Webhook ignores refunds / disputes / async failures.** Only `completed` and `expired` are handled; refunded orders stay `PAID`. The `OrderStatus` enum also lacks `REFUNDED`/`FAILED`.
- **M19 — State-changing GET requests.** `company-site/src/app/auth/accept-invite/page.tsx` and `company-site/src/app/api/account/verify-email-change/route.ts` mutate state on load → mail-scanners/prefetchers auto-trigger them, and neither verifies the visitor controls the target mailbox. Move to POST + explicit confirmation; always enforce token expiry.
- **M20 — `verify-email-change` has a comment claiming it repoints team emails — but no code does.** Implement it or delete the misleading comment (`company-site/src/app/api/account/verify-email-change/route.ts:69-70`).
- **M21 — Unvalidated `notificationEmail` / unbounded `proteinName`** in the codon route → arbitrary-recipient mail at scale and unbounded strings into Twist construct names / email subjects. Add `z.string().email()` and length caps.
- **M22 — Worker job claim isn't atomic.** `findFirst` then a separate `update` to PROCESSING; a crash strands jobs in PROCESSING with no requeue. Claim with `updateMany({ where: { status: 'PENDING' } })` and add a stale-PROCESSING sweep.
- **M23 — Operational tiering.** Free-tier web (cold starts delay webhook delivery) + free-tier Postgres (expires, connection-capped) for a transactional store, with a paid worker polling every 5s. Move Postgres to a paid plan; consider event-triggering the worker instead of tight polling.
- **M24 — No tests; no `error.tsx` / `not-found.tsx` / `loading.tsx` / `global-error.tsx`; no robots/sitemap.** The core optimizer (the main IP) has no CI tests. Add unit tests for `dp-optimizer`, `beam-search-optimizer`, `amino-acid-validation`, and the webhook handler; add route boundaries.

---

## 🟢 Low / cleanup

- **L25 — `Math.random()` in codon resolution** (`company-site/src/lib/codon-optimization.ts:152`): the same protein yields different DNA, and ambiguous `X` is resolved to a *random* amino acid (silently fabricates sequence). Reproducibility concern for a scientific tool — seed deterministically or reject ambiguous codes.
- **L26 — Filename used unsanitized in `Content-Disposition`** (`company-site/src/lib/s3.ts:38`) and stored unsanitized at upload. Strip control chars / use RFC 5987 encoding.
- **L27 — Non-null env assertions** (`process.env.X!`) in `company-site/src/lib/stripe.ts:3` and `company-site/src/lib/s3.ts:8-9` crash at runtime if unset. Add a fail-fast `env.ts` that validates required vars at startup.
- **L28 — `.env.example` is missing `AWS_*` and `SHIPSTATION_API_KEY`** (both read by code). Also note: code reads `NEXTAUTH_URL` (provisioned in `render.yaml`) while `.env.example` documents `AUTH_URL` — harmless in prod, confusing for local/dev setup.
- **L29 — Dead / duplicate code:**
  - `company-site/src/lib/otp.ts` — unimported, dead.
  - `OrderItem` model — unused legacy (app uses `VectorOrderItem` / `StrainOrderItem`).
  - **Two parallel project systems:** `CustomProject` / `Protein` / `ProjectStatus` vs `Project` / `ProjectProtein` / `ProjectStatus2`. The schema comments say the latter "replaces" the former, but both are live (`CustomProject` is still used in 5 pages). Finish the migration and drop the legacy models (under real migrations — see C4).
  - ~15 one-off analysis/benchmark/export scripts in `company-site/worker/` and the repo root (two untracked: `worker/optimize-batch-cis.ts`, `worker/optimize-cas9.ts`). Move out of the deployed worker dir or `.gitignore` them. Keep only `worker/codon-worker.ts`.

---

## What's genuinely solid (keep it this way)

- **Product prices are server-authoritative** — every line-item amount is fetched fresh from the DB; the client-sent cart price is ignored at checkout. (Shipping is the one exception — see C2.)
- **Stripe webhook signatures are verified** with `constructEvent` on the raw body before any processing.
- **Money is integer cents** throughout the schema and checkout.
- **S3 is private** — presigned GET URLs with 1-hour expiry, no public ACLs; no SSRF surface; image `remotePatterns` locked to one host.
- **Account-route IDOR is correctly prevented** — profile/team/email-change queries are scoped to `session.user.id`.
- **No role-mutation API exists** — role defaults to `USER` and is read from the DB into the session, never from user input.
- **Strong token randomness** (`crypto.randomBytes(32)`) with expiry and single-use on all token flows.
- **No raw SQL / `eval` / shell** anywhere; all queries go through the Prisma query builder.
- **TypeScript discipline** — `strict: true`, zero `any`, zero `@ts-ignore`, zero `eslint-disable` in app code; build does not suppress type/lint errors.
- **Clean secret hygiene** — nothing committed, history is clean, `.gitignore` is correct, the generated Prisma client is correctly ignored.
- **Good security headers** (X-Frame-Options DENY, nosniff, HSTS); Twist/Twilio admin endpoints are properly role-gated.

---

## Suggested remediation roadmap

**Phase 1 — Revenue & data integrity (do first)**
- [ ] C1 — persist strain & product order items
- [ ] C2 — recompute shipping server-side
- [ ] C3 — gate webhook on `payment_status` + add idempotency
- [ ] H14 — validate quantities; assert totals

**Phase 2 — Deploy safety**
- [ ] C4 — switch to `prisma migrate deploy`; remove `--accept-data-loss`; baseline current schema
- [ ] H10 — set `NEXT_PUBLIC_BASE_URL` in `render.yaml`

**Phase 3 — Access control**
- [ ] Add `middleware.ts` baseline gate for `/admin` + `/account`
- [ ] Extract a shared `requireAdmin()` helper → fixes H11 and standardizes H7/H8
- [ ] H7 / H8 — lock down file download + lot-file listing to admin
- [ ] H6 — separate team-member session identity from the owner; never inherit admin role
- [ ] H9 — add rate limiting; de-enumerate `check-email`
- [ ] H12 — validate order status transitions

**Phase 4 — Codon-optimization hardening**
- [ ] C5 — auth/rate-limit the POST, cap sequence length, validate `excludedPatterns`, add worker per-job timeout
- [ ] M21 / M22 — validate notification email; atomic job claim + stale sweep

**Phase 5 — Robustness & cleanup**
- [ ] M16–M20, M23–M24, L25–L29

---

## Notes on scope & corrections

Two findings raised during the review were verified as **false** and excluded: `render.yaml` is **not** missing — it is tracked at the repo root — and the generated Prisma client is **not** committed (it is correctly gitignored). Both were artifacts of a sub-review scoped only to `company-site/`.

This document reflects the state of `main` as of 2026-06-02. Severities assume the site is moving toward taking real payments; if it remains an internal/closed beta, the access-control items (H6–H9) and DoS item (C5) drop in urgency, but the revenue/data-loss items (C1–C3) and deploy-safety item (C4) do not.
