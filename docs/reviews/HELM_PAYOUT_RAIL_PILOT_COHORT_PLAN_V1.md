---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rail Pilot Cohort Plan v1

## Purpose

PR22 answers one narrow question on top of the already-landed readiness gate, pilot spec, settlement proof pack, and settlement exception layers:

- once Helm knows what a truthful first payout-rail pilot should look like, how should operators select one narrow cohort and rehearse the first off-platform dry run?

This PR does **not** implement payout rails.
It adds an internal-only cohort gate and operator readiness pack before any payout execution work starts.

## Current foundation already present

Current main already has:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry + attribution views
- PR14 manual settlement workflow + payout profile foundation
- PR15 contributor / partner onboarding + earnings portal light
- PR16 program catalog + terms + controlled application intake
- PR17 application review queue + invite issuance refinement
- PR18 payout-rails readiness gate
- PR19 settlement operations proof pack
- PR20 settlement reversal / exception handling polish
- PR21 payout rail pilot spec

That means Helm can already:

- decide whether payout posture is mature enough for a narrow pilot discussion
- keep manual settlement evidence visible
- keep reversal / exception posture explicit
- freeze a truthful one-country / one-currency / one-beneficiary-class pilot envelope

## Why cohort selection + operator pack is the next missing layer

PR21 freezes the spec for a first pilot.
It does **not** yet make the operator workflow explicit enough to answer:

- which exact beneficiary class should be chosen first?
- does current-main already have one narrow cohort or several?
- what should operators normalize before a dry run?
- what export contract and rollback triggers should be checked before any payout-rail PR starts?

Without this layer, the next payout-rail conversation still risks skipping from:

- readiness gate

straight into:

- payout execution design

without an explicit cohort-selection and dry-run checklist step.

## Proposed scope

PR22 should stay narrow and current-main-friendly.
It should add:

1. an internal-only pilot cohort gate
2. an operator readiness pack inside the existing settings / billing seam
3. a frozen dry-run export contract
4. explicit go / no-go and rollback triggers

It should **not** add:

- payout rails
- payout execution
- bank / wallet transfer
- public partner settlement controls
- marketplace behavior
- finance-console expansion

## Rollout phases

### Phase 0

Freeze this plan doc.

### Phase 1

Add a pure helper that can summarize:

- eligible beneficiary cohorts
- ready cohorts
- recommended beneficiary class
- recommended payout method label
- recommended currency
- operator checklist
- next moves
- dry-run export fields
- no-go / rollback triggers

### Phase 2

Expose that summary in the existing internal settings / billing seam as:

- an internal-only pilot cohort / operator pack card

### Phase 3

Freeze:

- baseline
- acceptance report
- README / docs discoverability
- self-check / boundary-check truth

## Preserved boundaries

PR22 must preserve all of the following:

- no payout rails
- no payout execution
- no bank / wallet transfer
- no public portal
- no marketplace
- no full finance console
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

## Validation contract

Because PR22 changes internal settings visibility and helper logic, validation should include:

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

PR22 does **not** implement:

- payout rails
- bank / wallet disbursement
- automatic settlement execution
- public partner portal
- marketplace
- partner ranking / discovery
- full finance console
- tax / invoice / retry / dunning
- SSO / SCIM
- full RBAC builder
- multi-workspace expansion

## Outcome target

After PR22, current main should be able to say:

- the payout-rail pilot spec exists
- one internal operator pack now exists for selecting a narrow cohort
- one dry-run export contract now exists
- one go / no-go / rollback checklist now exists
- and all of that still remains manual-first and non-executing
