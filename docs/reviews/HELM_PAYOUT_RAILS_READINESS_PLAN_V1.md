---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rails Readiness Plan v1

## Purpose

This document freezes PR18:
the payout-rails readiness gate on top of the already-landed billing, attribution, registry, manual-settlement, contributor-portal, program-catalog, and application-review foundations.

PR18 answers one narrow question:

- when is it worth connecting real payout rails?

It intentionally does **not** implement:

- payout rails
- bank / wallet transfer
- public marketplace
- public finance console
- payout execution

## Current foundation already present

Current main already has:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry and attribution views
- PR14 manual settlement workflow + payout profile foundation
- PR15 invited contributor portal light
- PR16 program catalog + terms + application intake
- PR17 application review queue + invite issuance refinement

That means the next missing layer is no longer data modeling or visibility.
It is a decision gate:

- do we have enough operational proof to justify a future payout-rail PR?

## Why readiness gate is the next missing layer

Current main can already:

- attribute revenue
- record payable-later amounts
- collect payout profile basics
- batch monthly settlement lines
- export CSV for off-platform payment
- let invited participants see their own earnings posture

But current main still cannot answer, in-product and in-docs:

- whether payout profile coverage is strong enough
- whether manual settlement has been exercised enough
- whether participant access has matured enough
- whether current missing-profile or reversal posture should block payout-rail work

That is the exact gap PR18 closes.

## Proposed readiness signals

PR18 should stay current-main-friendly and derive the gate from existing signals only:

1. payout profile readiness
   - active payout profiles exist
   - current batch missing-profile count is visible

2. settlement execution evidence
   - settlement batches exist
   - exported / closed batches exist
   - manual completion evidence exists through export-backed paid / reversed lines
   - paid-without-export anomalies stay visible as a watchpoint instead of being misread as completion proof

3. participant readiness
   - invited / active participant access exists

4. scope hygiene
   - payout remains manual / off-platform
   - no marketplace
   - no payout execution overclaim

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add a narrow derived readiness helper in the billing layer.

### Phase 2

Expose the readiness gate in settings / billing as an internal-readable card for the existing admin roles.

### Phase 3

Freeze the baseline and acceptance docs, update discoverability, and add tiny truthfulness guards.

## Preserved boundaries

PR18 must continue to preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no payout rails
- no payout execution
- no public marketplace
- no public finance console
- no send authority
- no workflow control

## Validation contract

After every phase:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

After any real product behavior / view change:

- `npm run build`
- `npm run test`

At final closeout:

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

PR18 does **not** implement:

- payout rails
- bank / wallet transfer
- invoice / tax / retry / dunning
- public partner portal
- public marketplace
- marketplace ranking / discovery
- full finance console
- full RBAC builder
- multi-workspace

## Target outcome

When PR18 is done, current main should be able to truthfully say:

- Helm now has an internal payout-rails readiness gate
- the gate explains whether payout profile coverage, settlement practice, and participant posture are mature enough for a later narrow payout-rail PR
- the gate does not claim payout execution already exists
