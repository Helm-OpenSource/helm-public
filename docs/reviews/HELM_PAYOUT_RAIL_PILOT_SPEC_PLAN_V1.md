---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rail Pilot Spec Plan v1

## Purpose

PR21 answers one narrow question on top of the already-landed billing, attribution, registry, manual-settlement, contributor-portal, program-catalog, application-review, readiness-gate, settlement-proof, and settlement-exception foundations:

- once the system can honestly say `READY_FOR_NARROW_PILOT`, what should a first real payout-rail pilot look like?

This PR does **not** implement payout rails.
It freezes the next decision layer before any payout execution work starts.

## Current foundation already present

Current main already has:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry + attribution views
- PR14 manual settlement workflow + payout profile foundation
- PR15 contributor / partner onboarding + earnings portal light
- PR16 program catalog + terms + application intake
- PR17 application review queue + invite issuance refinement
- PR18 payout-rails readiness gate
- PR19 settlement operations proof pack
- PR20 settlement reversal / exception handling polish

That means Helm can already:

- attribute revenue
- keep payable-later posture real
- maintain participant registry truth
- run manual settlement
- expose internal readiness and exception posture

What is still missing is the frozen answer to:

- when should a real payout-rail pilot begin?
- how narrow should the first pilot be?
- what should still remain manual?
- what should stop the pilot from widening too early?

## Why pilot spec is the next missing layer

PR18 only answers:

- is it worth evaluating payout rails?

PR19 and PR20 make that answer more honest by adding:

- manual settlement proof
- exported / paid / reversed evidence
- readable settlement exceptions and reversal posture

But current main still needs one more frozen layer:

- a pilot spec that keeps the first payout-rail attempt small, reviewable, and reversible

Without that spec, the next payout-rail PR risks overreaching into:

- broader payout execution
- marketplace assumptions
- public partner expectations
- finance-console behavior

## Proposed scope

PR21 should stay docs/spec/guard only.
No runtime payout behavior is required.
No schema expansion is required.

It should freeze:

1. the additional live-operating conditions required before a real pilot starts
2. the maximum allowed scope for the first pilot
3. the success criteria for a narrow pilot
4. the rollback / no-go triggers
5. the boundaries that must remain manual

## Rollout phases

### Phase 0

Freeze this plan doc.

### Phase 1

Create the product-facing pilot spec document that defines:

- pilot entry criteria
- pilot envelope
- pilot success criteria
- rollback triggers
- preserved boundaries

### Phase 2

Create an acceptance report that records:

- what was frozen
- what remained deferred
- what a future payout-rail PR must still prove

### Phase 3

Update:

- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

so the pilot-spec truth remains discoverable and guarded.

## Preserved boundaries

PR21 must preserve all of the following:

- no payout rails
- no payout execution
- no bank / wallet transfer
- no public portal settlement controls
- no marketplace
- no finance-console expansion
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

## Validation contract

Because this PR is docs/guard only, validation should include:

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## Explicitly deferred

PR21 does **not** implement:

- payout rails
- bank / wallet disbursement
- automatic settlement execution
- invoice / tax / retry / dunning
- public partner portal
- worker marketplace
- public partner marketplace
- partner ranking / discovery
- full finance console
- SSO / SCIM
- full RBAC builder
- multi-workspace expansion

## Outcome target

After PR21, current main should be able to say:

- the readiness gate exists
- the proof pack exists
- the exception/reversal layer exists
- and the first payout-rail pilot is now narrowly specified before any real payout execution work begins
