# CLAUDE.md — exploring-nextjs

Guidance for Claude Code sessions in this repository. The application lives in
`company-site/`; the repo root holds deploy config (`render.yaml`) and review
documents (`AUDIT.md`, `CODEX_RECOMMENDATIONS.md`, `CODEX_ACTIONS.md`).

## What this is

BioGrammatics' company site and store: a Next.js 16 App Router app selling
Pichia expression vectors and strains, with Stripe checkout, ShipStation
rates, S3 file delivery, magic-link auth (NextAuth v5, database sessions), a
public codon-optimization tool backed by a separate polling worker
(`company-site/worker/codon-worker.ts`), and a Twist Bioscience integration.
Deployed on Render from `main` (web service + worker + Postgres).

## Commands (run inside `company-site/`)

```bash
npm run dev          # local dev server
npx tsc --noEmit -p tsconfig.json   # typecheck (ignore stale errors under .next/)
npx eslint .         # lint — 3 known pre-existing errors, see AUDIT.md
npx vitest run       # tests (~0.4 s); npm run test:watch for watch mode
npx prisma generate  # after any schema.prisma change
```

Never run `prisma db push`, `prisma migrate`, or `npm run build` against a
database you have not confirmed is local. `.env` holds `DATABASE_URL`; check
that it points at `localhost` before any command that could touch a schema.
Production schema is applied by the web service's Render pre-deploy command
(`prisma db push`, no `--accept-data-loss`), which runs after build and before
the new instance starts; the build container cannot reach the database's
internal hostname. Migrations in `prisma/migrations/` are stale and must not
be used until baselined (AUDIT.md C4). Plans in `render.yaml` must match the
dashboard: a Blueprint sync applies them, and a lower value downgrades the
live resource.

## Start-of-session checks

- `npm view next dist-tags` vs the lockfile, and Node LTS status vs
  `render.yaml` `NODE_VERSION` (currently 24). Framework security releases
  are preannounced monthly; lagging them was the top finding of the
  September 2026 external review.

## Conventions that must be followed

These modules exist because copied logic drifted into real bugs. Use them;
do not re-implement.

- **Authorization — `src/lib/auth-guards.ts`.** Every admin API handler calls
  `requireAdmin()` (or `requireSuperAdmin()`) and returns `guard.response` if
  set. Every admin `page.tsx`/`layout.tsx` calls `requireAdminPage()`. Every
  `"use server"` action on an admin page starts with `await
  assertAdminAction()` — layouts do NOT protect Server Actions. Account routes
  use `requireUser()`. Never compare `session.user.role` to a string inline.
  Helpers return 401 for anonymous, 403 for signed-in non-admins.
- **Team logins.** `session.user.isTeamLogin` is true when a colleague signed
  in via an owner's `AuthorizedEmail`. Such sessions are forced to role USER
  and must be rejected by anything that changes account identity (email,
  team membership, roles). The guards already do this. The adapter re-checks
  membership on every lookup; revoking a team email deletes its sessions.
- **Session versioning — `src/lib/session-version.ts`.** Every Session row
  is stamped with `SESSION_AUTH_VERSION`; the adapter deletes rows with any
  other value. Bump the constant when the meaning of a session changes and
  every user will re-authenticate once. Mint sessions only through the
  adapter or with the stamp.
- **Rate limiting — `src/lib/rate-limit.ts`.** Any endpoint that sends mail,
  reveals account existence, or enqueues CPU work calls `rateLimitResponse`
  first. The store is in-memory (single instance); swap it before scaling.
- **Email identity — `src/lib/identity.ts`.** Call `normalizeEmail()` before
  any create/find/compare on `User.email`, `Order.customerEmail`,
  `AuthorizedEmail.email`. Validate input with `isValidEmail()`.
- **Product visibility — `src/lib/visibility.ts`.** Use `publicVectorWhere`,
  `publicStrainWhere`, `isVectorPublic/Purchasable`, `isStrainPublic/Purchasable`
  for catalog, detail, file, and checkout queries. Entitlement checks use
  `PURCHASED_ORDER_STATUSES` (spread into Prisma `in`: `[...PURCHASED_ORDER_STATUSES]`).
- **Order status — `src/lib/order-status.ts`.** The enum list, labels,
  colours, `ADMIN_ORDER_TRANSITIONS`, and the `SHIPPING_PENDING_QUOTE`
  sentinel. Payment-derived statuses are written only by the Stripe webhook.
- **Order lines — `src/lib/order-lines.ts`.** Orders have three item
  relations (`items`, `vectorOrderItems`, `strainOrderItems`). Always include
  via `orderLineInclude` and render via `flattenOrderLines`/`countOrderLines`.
- **Codon intake — `src/lib/codon-optimization.ts`.** `validateProteinSequence`
  accepts exactly the 20 standard amino acids plus one optional trailing `*`,
  tolerates whitespace and one FASTA header line, and reports every other
  character with its position and a fix; nothing is silently stripped or
  substituted (ambiguity codes are rejected, never randomised). Length is
  capped at 2,500 aa (Twist synthesis ~7 kb); longer proteins are custom
  projects and the error says so. `validateExclusionPattern`
  (IUPAC + `[...]` + `{n}` only; no commas, no regex metacharacters) are the
  only accepted validators for job submission. Known gap (AUDIT H49): the
  optimizers do not expand IUPAC codes, so `GCN` currently matches nothing;
  do not advertise IUPAC support until the shared motif parser exists.
- **Order status writes** go through a conditional update on the expected
  current status (`updateMany({ where: { id, status: current } })`) and only
  targets listed in `ADMIN_ORDER_TRANSITIONS`; payment-derived states are
  written by the Stripe webhook alone.

## Next.js 16 specifics

- `params` and `searchParams` are Promises in pages and route handlers:
  `const { id } = await params;`. Sync access silently yields `undefined`.
- Middleware is `src/proxy.ts` (none exists yet). The `authorized` callback in
  `auth.config.ts` is therefore dead code; do not rely on it.
- Server Actions execute before layouts render. Authorize inside the action.

## Testing

Vitest, node environment, `src/**/*.test.ts`. Route tests mock
`@/lib/auth` (`vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))`) and
`@/lib/db` with per-model `vi.fn()`s; session fixtures live in
`src/test/session-fixtures.ts` (`userSession`, `adminSession`,
`superAdminSession`, `teamLoginSession`, `makeSession()`). New admin or
account routes should get a test covering anonymous / USER / ADMIN /
SUPER_ADMIN / team-login. Pure library code (`src/lib/*.ts`) gets a sibling
`*.test.ts`.

## Layout

```
company-site/
  prisma/schema.prisma         44 models; Vector/Strain + lots + files; Order + 3 item relations;
                               CodonOptimizationJob; AuthorizedEmail (team access)
  src/app/                     App Router. admin/**, account/**, api/**, public catalog
  src/lib/                     shared modules (see Conventions), integrations (stripe, s3,
                               shipstation, twist, twilio), optimizers (dp-optimizer,
                               beam-search-optimizer, repeat-breaker)
  worker/codon-worker.ts       the only production worker; other worker/*.ts are one-off scripts
  data/codon-optimization/     ninemer score tables (2 MB JSON) and exclusions.txt
  *.ts at package root         one-off analysis scripts, not part of the app
```

## Known state

`AUDIT.md` is the authoritative list of open issues with stable IDs; cite
them in commit messages (e.g. "closes H37"). `CODEX_ACTIONS.md` maps the
July 2026 external review's recommendations to what has been done;
`CODEX_ASTRA.md` is the September 2026 independent review whose findings
are folded into AUDIT.md as C47–M56. Its lesson: do not mark an item fixed
after repairing the local code path — prove the lifecycle (event ordering,
session revocation, worker fencing, motif semantics) with a probe.
Debug pages (`/admin/twist-test`, `/admin/twilio-test`, `api/twist/*`) are
development tooling that currently ships to production (AUDIT.md M42).
`SECURITY_README.md` describes an encryption design that is not implemented
(M41).

## Commit style

Imperative subject under ~70 chars, body explaining the bug and the fix,
reference AUDIT IDs. Work on a branch and fast-forward `main`; Render
deploys `main`. Do not push without being asked.
