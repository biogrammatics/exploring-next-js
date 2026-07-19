# Codex Recommendations: BioGrammatics Website Rebuild

**Reviewed:** July 18, 2026  
**Project:** `exploring-nextjs`  
**Application:** `company-site/`  
**Review type:** Read-only architecture, security, commerce, public-site, content, and quality review

## Executive summary

The project has a promising technical foundation and a substantial amount of domain-specific functionality. It should still be treated as a pre-launch prototype rather than a production commerce system or complete replacement company website.

The immediate priority should be stabilizing payment integrity, database migrations, authorization, and the codon-optimization workload. After that, complete and verify one coherent public customer journey before adding more features. The existing `AUDIT.md` is a strong remediation backlog, but its most serious findings remain substantially current.

Do not enable production payments until the P0 findings below have been addressed and covered by automated tests.

## P0: Launch blockers

### 1. Recompute shipping charges server-side

**Location:** `company-site/src/app/api/checkout/route.ts:169-192`

The checkout API accepts `shippingRate.costCents` from the request and uses it directly for both Stripe and the order record. A customer can alter the request and select free or reduced shipping.

Recommended change:

- Accept only a service identifier from the browser.
- Recalculate available rates server-side for the submitted destination.
- Match the submitted service identifier to an allowed returned rate.
- Apply all handling fees and business rules server-side.
- Reject stale, missing, or mismatched rates.

### 2. Persist every charged product as an order item

**Location:** `company-site/src/app/api/checkout/route.ts:112-209`

Vectors, strains, and generic products can be added to Stripe line items, but only vector items are written during order creation. A customer can therefore be charged for a strain or generic product that fulfillment and the customer account cannot see.

Recommended change:

- Build separate validated collections for vector, strain, and generic-product items.
- Create all corresponding order items in the same order transaction.
- Assert that the persisted item totals exactly equal the Stripe subtotal.
- Add integration tests covering mixed carts.

### 3. Make Stripe webhook processing payment-aware and idempotent

**Location:** `company-site/src/app/api/webhooks/stripe/route.ts:28-79`

`checkout.session.completed` marks an order paid without checking `payment_status`. Event replay can also repeat account creation and order updates.

Recommended change:

- Require `session.payment_status === "paid"` before fulfillment.
- Persist processed Stripe event IDs, or use an atomic conditional state transition.
- Process the user association and order transition in a transaction.
- Use `upsert` for race-safe account handling.
- Add handlers and states for refunds, disputes, expiration, and asynchronous payment failure where applicable.

### 4. Replace destructive production schema synchronization with migrations

**Location:** `render.yaml:13`; `company-site/package.json:7`

The production build runs `prisma db push --accept-data-loss`. The Prisma schema has substantially outgrown the three committed migrations, so an ordinary schema edit can silently remove production data.

Recommended change:

- Take and verify a production database backup.
- Baseline the current production schema into versioned migrations.
- Reconcile and commit all schema changes.
- Deploy with `prisma migrate deploy`.
- Remove `db push` from both production and normal application build commands.
- Keep schema migration and application compilation as separate deployment steps.

### 5. Bound and protect codon-optimization workloads

**Locations:**

- `company-site/src/app/api/codon-optimization/route.ts:10-69`
- `company-site/src/lib/dp-optimizer.ts:220-252`
- `company-site/worker/codon-worker.ts`

The submission endpoint permits anonymous jobs without rate limiting or a sequence-size cap. User-supplied exclusion strings can become regular expressions, and the worker has no clear per-job execution deadline. This creates denial-of-service, queue starvation, and external-service cost risks.

Recommended change:

- Require authentication for full jobs; optionally provide a tightly limited public trial.
- Add per-user and per-IP rate limits and concurrency quotas.
- Cap protein length, pattern count, pattern length, and notification fields before inserting a job.
- Treat exclusion input as biological motifs rather than arbitrary regular expressions, or use a safe linear-time representation.
- Add a per-job wall-clock deadline and stale-job recovery.
- Claim queued jobs atomically.
- Record algorithm version, input hash, parameters, and deterministic seed for scientific reproducibility.

## P1: Security, authorization, and correctness

### 6. Centralize authorization

The `authorized` callback in `src/lib/auth.config.ts` is not wired into middleware, while individual handlers contain duplicated and inconsistent checks. Some routes accept `ADMIN` and `SUPER_ADMIN`; others accept only `ADMIN`.

Recommended change:

- Add a baseline Next.js middleware/proxy gate for account and administrative route groups.
- Create shared `requireUser`, `requireAdmin`, and `requireRole` server helpers.
- Keep resource-level authorization inside each handler as defense in depth.
- Add authorization tests for anonymous, user, admin, and super-admin sessions.

### 7. Redesign team access so it does not inherit the owner's identity and role

Team-email login currently resolves to the owner account, including the owner's role. If an administrator authorizes another email, that person can inherit administrative access.

Recommended change:

- Give each human a distinct user identity.
- Model organization membership and roles separately from identity.
- Never inherit an account owner's platform role.
- Record who performed each administrative or scientific action.
- Shorten magic-link lifetimes and add throttling to all authentication/email endpoints.

### 8. Enforce publication status on direct product routes and files

**Locations:**

- `company-site/src/app/vectors/[id]/page.tsx:33-49`
- `company-site/src/app/api/admin/files/[fileId]/download/route.ts:26-39`
- `company-site/src/app/api/admin/vectors/[id]/lots/[lotId]/files/route.ts:97-111`

The vector catalog filters unavailable products, but the detail route performs an unrestricted ID lookup. Any authenticated user can download files for unavailable vectors, and any authenticated user can list lot QC file metadata.

Recommended change:

- Apply publication predicates on every public detail query.
- Provide an explicit, admin-only preview mechanism.
- Require admin access for unpublished files and lot/QC data.
- Move public file delivery to a clearly named public route rather than an `/api/admin/` route.

### 9. Validate all checkout and administrative state changes

Checkout quantities and administrative order statuses are accepted without sufficient runtime validation or transition rules.

Recommended change:

- Validate every request using shared Zod schemas.
- Require positive integer quantities with sensible maximums.
- Validate addresses, email, phone, country, and product-type discriminators.
- Enforce an explicit order-state transition matrix.
- Assert server-computed subtotal, shipping, tax, and total before creating Stripe sessions.

### 10. Add upload limits and content validation

Administrative uploads are loaded into memory without clear size limits or verification that bytes match the declared content type.

Recommended change:

- Set file-size limits by artifact type.
- Check file signatures and content, not only filename extensions or form labels.
- Stream large files or upload directly to S3 using short-lived presigned upload credentials.
- Sanitize download filenames.
- Move thumbnails out of base64 database fields.

## P1: Public website and customer journey

### 11. Remove or implement broken primary routes

**Locations:**

- `company-site/src/app/layout.tsx:63-74`
- `company-site/src/app/page.tsx:108-160`

The primary navigation and homepage link to `/subscriptions`, `/services`, and `/path-to-protein`, but those route implementations do not exist.

Recommended change:

- Implement the routes needed for the first release, or remove the links.
- Add an automated internal-link check to CI.
- Define the minimum launch journey explicitly: discover, evaluate, purchase or inquire, receive confirmation, and obtain support/documentation.

### 12. Do not present strain purchasing as functional until it is wired through

**Location:** `company-site/src/app/strains/[id]/page.tsx:194-205`

The “Add to Cart” control is a plain button with no event handler. It gives customers the impression that the action succeeded.

Recommended change:

- First fix strain order persistence.
- Then connect the page to the shared cart component.
- Until that is complete, show an honest “Request availability” or “Contact us” action.

### 13. Improve information architecture and conversion content

The homepage is attractive but generic. It does not yet clearly route distinct audiences such as research scientists, process-development teams, procurement, or prospective service clients.

Recommended change:

- Lead with concrete customer problems and evidence-backed outcomes.
- Provide distinct paths for buying reagents, designing an expression strategy, requesting services, and reading technical guidance.
- Add trust material: application notes, citations, representative workflows, quality practices, shipping expectations, licensing terms, and support contacts.
- Add comparison tools for vectors and strains based on scientific decision criteria.
- Prefer stable public slugs such as `/vectors/pjan` over internal CUIDs.

### 14. Build responsive and accessible navigation

The current navigation is a single desktop row without a mobile menu. The animated background runs continuously and does not visibly respect reduced-motion preferences.

Recommended change:

- Add a keyboard-accessible mobile navigation pattern.
- Add a skip link and visible focus styling.
- Respect `prefers-reduced-motion` and pause nonessential animation.
- Test contrast across every animated background state.
- Test product and checkout flows using keyboard and screen-reader navigation.

### 15. Establish a complete SEO baseline

Only global and legal-page metadata are present. There is no visible sitemap, robots configuration, canonical strategy, structured product data, or dynamic product metadata.

Recommended change:

- Add `sitemap.ts` and `robots.ts`.
- Generate titles and descriptions for each vector and strain.
- Set `metadataBase`, canonical URLs, Open Graph, and social images.
- Add `Product`, `Organization`, `BreadcrumbList`, and applicable scientific/article structured data.
- Add explicit `not-found.tsx`, `error.tsx`, and loading boundaries.

### 16. Optimize product images and delivery

Several public pages use raw `<img>` elements and base64 thumbnails. This increases page weight and bypasses Next.js image optimization.

Recommended change:

- Store product media in S3 or another managed object store.
- Generate durable variants and meaningful alt text.
- Use `next/image` or an intentional image pipeline.
- Put downloadable public assets behind a CDN with cache/version semantics.

## P1: Legal and data-governance content

### 17. Reconcile legal pages with actual practices

**Locations:**

- `company-site/src/app/privacy/page.tsx`
- `company-site/src/app/cookies/page.tsx`
- `company-site/src/app/terms/page.tsx`

The privacy and cookie pages calculate “Last updated” using the current date, so they appear newly revised every day. They also describe passwords, password hashing, analytics cookies, marketing cookies, consent controls, regular security assessments, data-transfer safeguards, and other practices that are absent or cannot be verified from the implementation.

Recommended change:

- Use a fixed, reviewed revision date and document version.
- Build a data-flow and subprocessor inventory first.
- Remove claims that do not match deployed behavior.
- Add real preference controls before promising that users can change them.
- Have qualified counsel review terms for research-use products, licensing, sequence confidentiality, international shipping, export controls, refunds, and limitation of liability.

## Engineering quality and delivery

### 18. Add tests before expanding scope

No automated test suite or test script was found. The most critical behavior—pricing, orders, entitlements, webhooks, authentication, and the optimization algorithms—is currently unprotected.

Recommended initial test portfolio:

- Unit tests for amino-acid validation, FASTA parsing, codon optimization, and deterministic output.
- Route tests for authorization and request validation.
- Stripe integration tests for each product type, mixed carts, webhook replay, and failed payments.
- Database tests for order creation and state transitions.
- Playwright tests for navigation, sign-in, catalog, cart, checkout, and account history.
- Accessibility and broken-link checks in CI.

### 19. Make a clean checkout reproducible

The current local dependency installation is incomplete/stale. `npm ls --depth=0` reports missing AWS SDK and Twilio dependencies as well as version mismatches. A direct typecheck also sees stale generated Next.js and Prisma artifacts.

Recommended change:

- Verify `npm ci` from a clean clone.
- Run Prisma generation explicitly before typechecking.
- Add CI jobs for dependency installation, Prisma generation, lint, typecheck, tests, and build.
- Do not make application builds depend on access to—or mutation of—a production database.
- Pin the deployment Node and package-manager versions.

### 20. Reduce parallel and legacy domain models

The Prisma schema retains both legacy and replacement project systems, plus a generic product/order system alongside specialized vector and strain systems. This creates ambiguity about the authoritative business model.

Recommended change:

- Decide which models are canonical.
- Migrate live data under versioned migrations.
- Remove legacy models only after verification and backup.
- Document invariants such as entitlement rules, ownership, order-item types, pricing authority, and fulfillment requirements.

## Documentation and MCP architecture

The website should not become an accidental second documentation repository. Use explicit sources of truth:

- **PostgreSQL:** prices, availability, orders, entitlements, accounts, and structured product specifications.
- **Version-controlled Markdown:** approved SOPs, application notes, recommendations, public protocols, FAQs, and company policies.
- **Labguru:** experimental records, raw observations, and evidence supporting approved scientific guidance.
- **Craft:** an optional authoring and review interface, not the only authoritative store.

Each approved document should include:

- Stable document ID and canonical URL
- Title and summary
- Owner and approver
- Internal, customer, or public audience classification
- Draft, reviewed, approved, superseded, or retired status
- Effective and review dates
- Version and change history
- Source experiments, citations, and related products
- Safety, confidentiality, and regulatory classification
- Superseded-by relationship

The company-documentation MCP can then retrieve only content appropriate to the requester's identity and audience. Answers should identify their sources, versions, and approval status. Public website agents must never inherit access to internal financial, customer, experimental, or unpublished product information.

## Suggested delivery sequence

### Milestone 0: Production safety

1. Fix checkout item persistence and server-side shipping.
2. Make Stripe webhook processing idempotent and payment-aware.
3. Adopt production migrations and backups.
4. Bound codon-optimization workloads.
5. Centralize authorization and redesign team identity.
6. Add tests for all of the above.

### Milestone 1: Coherent public release

1. Choose and complete the initial customer journey.
2. Remove all placeholder controls and dead links.
3. Add responsive navigation, accessibility, SEO, and operational error pages.
4. Reconcile legal copy with deployed behavior.
5. Add monitoring for checkout, webhook failures, worker backlog, and email delivery.

### Milestone 2: Content and documentation platform

1. Define the documentation schema and approval workflow.
2. Publish technical guidance from versioned content rather than hardcoded JSX.
3. Connect approved Labguru-derived evidence through a controlled review process.
4. Expose audience-filtered content through the documentation MCP.
5. Add citations, provenance, feedback, and review-expiration reporting.

### Milestone 3: Expansion

1. Implement subscriptions and the complete service pathway.
2. Add product comparison and technical decision support.
3. Integrate account entitlements with approved product documentation.
4. Add carefully scoped AI assistance over the approved knowledge corpus.

## Verification performed

- Reviewed the existing architecture, migration plan, audit, deployment configuration, Prisma schema, authentication, checkout, Stripe webhooks, uploads, public catalog, legal pages, and codon-optimization paths.
- `npm run lint` failed with **7 errors and 42 warnings** across the repository.
- Linting only `src` and the production worker failed with **3 errors and 20 warnings**.
- No automated test suite or test script was found.
- `npm ls --depth=0` showed an incomplete/stale local installation.
- A trustworthy type/build result could not be obtained from the existing installation because dependencies and generated Prisma/Next.js artifacts were stale.
- `npm run build` was intentionally not run because it invokes `prisma db push`, which can mutate the configured database.
- No project files were modified during the review that produced these recommendations.

## Bottom line

The project is worth continuing. Its strongest parts are the breadth of BioGrammatics domain modeling, server-authoritative product pricing, private S3 design, Stripe signature verification, strict TypeScript intent, and the substantial scientific optimization work.

The next increment should be consolidation rather than feature expansion: make money and identity paths correct, make deployment recoverable, make scientific jobs bounded and reproducible, and make the public site honest about what is implemented. Once those foundations are reliable, the same application can become a useful publishing and transactional layer over the broader company documentation system.
