# Actions Taken on the Codex Recommendations

**Companion to:** `CODEX_RECOMMENDATIONS.md` (external review dated 2026-07-18)
**Log through:** 2026-09-12 (`main` at `9420262`)
**Cross-reference:** finding IDs (`C#`, `H#`, `M#`, `L#`) are from `AUDIT.md`.

Each numbered section below mirrors a numbered recommendation in
`CODEX_RECOMMENDATIONS.md`. Status is one of **Done**, **Partial**, or
**Not started**, followed by what was actually changed and, where relevant,
what remains.

Commits referenced:

| Commit | Date | Subject |
|--------|------|---------|
| `e9c1543` | 2026-07-18 | Fix checkout payment-integrity bugs: persist all items, recompute shipping server-side |
| `877515b` | 2026-07-18 | Make Stripe webhook payment-aware and idempotent |
| `2c06c05` | 2026-07-18 | Add Tier 1 tests: scientific core |
| `cbb80a6` | 2026-07-18 | Add Tier 2 tests: authorization guards and an auth-mock harness |
| `8fe8fe2` | 2026-07-18 | Enforce publication/admin status on product detail and file routes |
| `e76d61d` | 2026-09-12 | Add shared auth, identity, visibility and order-line modules |
| `e0736d3` | 2026-09-12 | Guard admin Server Actions, pages and API routes with the shared helpers |
| `78b289e` | 2026-09-12 | Contain team-login sessions and normalize email identity everywhere |
| `4ffb044` | 2026-09-12 | Require shipping quotes, enforce visibility, and show real order lines |
| `273d351` | 2026-09-12 | Harden codon-optimization intake and the worker job lifecycle |
| `9420262` | 2026-09-12 | Stop mutating the database from npm run build; fail deploys on data loss |

---

## P0: Launch blockers

### 1. Recompute shipping charges server-side — **Done** (C2)
- `e9c1543`: the client sends only `serviceCode`; the server re-quotes ShipStation for the submitted destination and uses the matching server-side price. Tampered `costCents` is ignored.
- `4ffb044`: closed the remaining gap where *omitting* `shippingRate` produced a $0-shipping order. The server now always quotes; with quotes available and no selection it returns 400; when the carrier is unavailable it records `shippingMethod = PENDING_QUOTE` and a Stripe metadata flag, surfaced as a red badge in the admin order list and detail. The client's `ratesFallback` flag is never trusted.
- Tests: `src/app/api/checkout/route.test.ts` covers recompute, mismatch, no-selection-with-quotes (400), carrier-down (PENDING_QUOTE), and ignored fallback flag.

### 2. Persist every charged product as an order item — **Done** (C1)
- `e9c1543`: vector, strain and generic-product items are collected separately and written to `vectorOrderItems`, `strainOrderItems`, `items` in the same `order.create`; the persisted item sum is asserted against the Stripe subtotal.
- `4ffb044`: admin order list, detail and both admin order APIs now read all three relations via `src/lib/order-lines.ts` (they previously showed vector/strain orders as "0 items").
- Remaining: `shippedLotId` is still never assigned at checkout or fulfilment (TODO.md item).

### 3. Make Stripe webhook processing payment-aware and idempotent — **Done** (C3, H13, M18)
- `877515b`: requires `payment_status === "paid"`; records `event.id` in `ProcessedWebhookEvent` inside the same transaction as the order update (replay hits P2002 and is acknowledged); conditional `updateMany` transitions; user association via `upsert`; handlers for `async_payment_failed`, `session.expired`, `charge.refunded`, `charge.dispute.created`; `OrderStatus` gained `PROCESSING`, `PAYMENT_FAILED`, `REFUNDED`, `DISPUTED`.
- `78b289e`: customer email is normalized before the upsert so the webhook and the magic-link path agree on identity (previously a mixed-case checkout email created a second, un-loginable User).
- Tests: `src/app/api/webhooks/stripe/route.test.ts`.

### 4. Replace destructive production schema synchronization with migrations — **Partial** (C4)
- `9420262`: `npm run build` is now `prisma generate && next build` (a local build can no longer mutate whatever `DATABASE_URL` points at). `render.yaml` runs `prisma db push` **without** `--accept-data-loss`, so a schema change that would drop data fails the deploy and leaves the previous release running.
- `ff40ea7`, `814442a`: the schema sync moved out of the Render build command entirely into a `preDeployCommand` — build containers cannot reach the database's internal hostname, which the Blueprint supplies via `fromDatabase.connectionString`. Schema migration and application compilation are now separate deployment steps, as recommended.
- Also in this pass (`ccd5289`, `793e4da`, `814442a`): the first Blueprint sync since February exposed drift between `render.yaml` and the dashboard — retired `starter` plan name, database upgraded to Basic-256mb, web service upgraded to the $7 instance. The file now declares the actual plans; a sync had briefly downgraded the web service to free before this was corrected.
- Not done: taking a verified backup, baselining the current production schema into a migration, and switching to `prisma migrate deploy`. These require production database access and a maintenance window. Steps are listed in `AUDIT.md` Phase A.

### 5. Bound and protect codon-optimization workloads — **Partial** (C5, M21, M22)
- `273d351`:
  - Protein length > 10,000 aa is an error (was a warning); raw request body over 15,000 characters is rejected before validation.
  - Exclusion patterns are treated as biological motifs: IUPAC codes, `[...]` classes and bounded `{n}` quantifiers only, ≤ 64 chars, ≤ 50 patterns, compile-checked. No `( ) + * ? | . ^ $ \`; catastrophic backtracking is not constructible.
  - `notificationEmail` must validate (required for guests) and is normalized; `proteinName` is control-stripped and capped at 200.
  - Job ids are `uuid()` (guest jobs rely on the id being unguessable; cuid was enumerable).
  - Worker claims jobs atomically (`updateMany` guarded on `PENDING`, proceeds only if `count === 1`), requeues `PROCESSING` rows older than 30 minutes at startup and every 60 polls, and finishes the in-flight job on SIGTERM.
  - A terminal `*` is stripped consistently by API and worker (previously every FASTA-style paste failed).
- Tests: `src/lib/codon-optimization.test.ts`, `src/app/api/codon-optimization/route.test.ts`.
- Not done: authentication requirement for full jobs (guest submission was kept as a product decision, now gated on a valid email); per-user/per-IP rate limits and concurrency quotas (AUDIT H37); a per-job wall-clock deadline — the optimizer is synchronous, so this needs a `worker_threads` Worker (AUDIT H38); recording algorithm version, input hash and seed for reproducibility.

## P1: Security, authorization, and correctness

### 6. Centralize authorization — **Done (helpers); Not started (middleware)** (H11)
- `e76d61d` + `e0736d3`: `src/lib/auth-guards.ts` provides `requireUser`, `requireAdmin`, `requireSuperAdmin` (API routes), `assertAdminAction`/`assertSuperAdminAction` (Server Actions), `requireAdminPage`/`requireUserPage` (pages). All 22 admin and Twist API handlers, all 19 admin page/layout files, and all 12 admin Server Actions use them; the 30 hand-rolled role comparisons in four spellings are gone. Anonymous → 401, signed-in non-admin → 403, consistently.
- Discovered and fixed in the same pass: the 12 admin Server Actions had **no** authorization at all (the layout redirect does not run before an action executes) — AUDIT C30.
- Tests: `src/lib/auth-guards.test.ts` (20 cases) plus per-route authorization tests for anonymous / user / admin / super-admin / team-login sessions.
- Not done: the baseline `src/proxy.ts` gate for `/admin` and `/api/admin`. The per-call helpers are verified complete by grep; the proxy is still recommended as defense in depth.

### 7. Redesign team access so it does not inherit the owner's identity and role — **Partial** (H6)
- `78b289e`: a team login is flagged on the `Session` row (`isTeamLogin`, `teamEmail`); the Prisma adapter is wrapped so the session callback sees the flag and forces `role = USER`; `change-email`, team invite/revoke, admin guards and admin product previews reject team sessions; magic-link verification resolves a primary `User` before an `AuthorizedEmail` (so an address that is both never lands in someone else's account); `verify-email-change` and `accept-invite` refuse addresses already in use as the other kind.
- Also fixed: re-inviting a revoked team email 500'd on the unique constraint (M34).
- Tests: `src/lib/auth.test.ts`, `src/app/api/account/team/route.test.ts`.
- Not done: the full redesign — distinct `User` per human with organization membership modelled separately, per-actor audit trail, shorter magic-link lifetime. Team members still act *as* the owner's data scope, just with USER privileges and no identity controls.

### 8. Enforce publication status on direct product routes and files — **Done** (H7, H8, M36)
- `8fe8fe2`: vector detail page and file download route gate on availability; lot-file listing requires admin.
- `4ffb044`: `src/lib/visibility.ts` gives one predicate (`isPublic && productStatus.isAvailable`, plus `availableForSale`/`salePrice` for purchasability) used by both catalog lists, both detail pages (public OR non-team admin OR purchaser), the file view/download routes and both checkout branches. `Vector.isPublic` — previously never read or written — is now editable in the admin vector forms (`e0736d3`).
- Not done: moving public file delivery off the `/api/admin/files/...` path to a clearly public route name.

### 9. Validate all checkout and administrative state changes — **Done** (H12, H14)
- `e9c1543`: positive integer quantities ≤ 1000; server-computed subtotal asserted.
- `4ffb044`: order-status PATCH parses JSON defensively, validates against `z.enum(ORDER_STATUSES)`, 404s missing orders, and enforces `ADMIN_ORDER_TRANSITIONS` (admins move orders through fulfilment or cancel; payment-derived states are webhook-only). The status form offers only allowed transitions, checks `response.ok`, shows the server error and reverts. Checkout validates and normalizes the customer email.
- Tests: `src/app/api/admin/orders/[id]/route.test.ts` (18 cases).
- Not done: full Zod schemas for the shipping address, phone and country; tax (M17).

### 10. Add upload limits and content validation — **Not started** (H15)
- No size limit, magic-byte check, streaming, presigned-upload flow, filename sanitisation (L26) or thumbnail relocation has been implemented. Admin-only surface, so lower urgency than the items above.

## P1: Public website and customer journey

### 11. Remove or implement broken primary routes — **Not started**
- `/subscriptions`, `/services`, `/path-to-protein` are still linked from `layout.tsx` and `page.tsx` and still do not exist.

### 12. Do not present strain purchasing as functional until it is wired through — **Partial**
- Persistence (the prerequisite) is done (`e9c1543`) and the strain checkout branch now enforces visibility (`4ffb044`).
- The strain detail page's "Add to Cart" is still an inert placeholder button.

### 13. Improve information architecture and conversion content — **Not started**

### 14. Build responsive and accessible navigation — **Not started**

### 15. Establish a complete SEO baseline — **Not started**
- No `sitemap.ts`, `robots.ts`, `error.tsx`, `not-found.tsx`, or `loading.tsx` (also AUDIT M24).

### 16. Optimize product images and delivery — **Not started**
- Thumbnails remain base64 in the database; several list pages fetch them without rendering them (AUDIT M43).

## P1: Legal and data-governance content

### 17. Reconcile legal pages with actual practices — **Not started**
- Privacy and cookie pages still render `new Date()` as "Last updated" and still describe passwords, analytics/marketing cookies and consent controls that do not exist.
- Related: `SECURITY_README.md` describes an unimplemented encryption feature (AUDIT M41).

## Engineering quality and delivery

### 18. Add tests before expanding scope — **Done (initial portfolio)** (M24)
- `2c06c05`, `cbb80a6` (July) and the 2026-09-12 commits: 19 test files, 196 tests, ~0.4 s. Coverage: amino-acid validation, FASTA parsing, DP optimizer, repeat-breaker, codon intake validation, auth config, auth adapter/session callback, auth guards, checkout (pricing, shipping, visibility, email), Stripe webhook (signature, idempotency, lifecycle, normalization), admin users/products/orders/files routes, team routes, ShipStation rate pipeline, profile route.
- Not done: Playwright end-to-end tests, database-backed tests, accessibility and broken-link checks, CI.

### 19. Make a clean checkout reproducible — **Partial**
- `9420262`: application build no longer depends on or mutates a database.
- Verified locally on 2026-09-12: `npx tsc --noEmit` clean, `npx vitest run` green, `npx eslint .` down from 7 errors to 3 (all pre-existing, in untouched files).
- Not done: `.github/workflows` CI (install, generate, lint, typecheck, test, build); pinned package-manager version; `.env.example` still missing `AWS_*` and `SHIPSTATION_API_KEY` (L28).

### 20. Reduce parallel and legacy domain models — **Not started** (L29 / L44)
- `Product`/`OrderItem`, `CustomProject`/`Protein`, and `Address` remain in the schema and, for the first two, in live code paths. Their removal is explicitly blocked on adopting real migrations (recommendation 4), since dropping them under `db push` would now fail the deploy rather than silently destroy data — which is the intended safety net, not a workaround.

## Documentation and MCP architecture — **Not started**
No documentation schema, approval workflow, or MCP retrieval layer has been built. Out of scope for the code-hardening work to date.

---

## Summary by milestone (from the Codex delivery sequence)

| Milestone 0 step | Status |
|------------------|--------|
| Fix checkout item persistence and server-side shipping | Done |
| Make Stripe webhook idempotent and payment-aware | Done |
| Adopt production migrations and backups | Partial — deploy is safe-by-failure; baseline pending |
| Bound codon-optimization workloads | Partial — inputs bounded, claims atomic; deadline and throttling pending |
| Centralize authorization and redesign team identity | Done (helpers) / Partial (team model contained, not redesigned) |
| Add tests for all of the above | Done |

Milestones 1–3 (public release coherence, content platform, expansion) have not been started. The next increment should complete Milestone 0's two partials (migrations, rate limiting + worker deadline) before any public-facing work.
