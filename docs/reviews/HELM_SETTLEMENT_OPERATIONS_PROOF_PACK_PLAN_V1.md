---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Settlement Operations Proof Pack Plan v1

## Purpose

This document freezes PR19:
Settlement Operations Proof Pack.

PR19 answers one narrow follow-up to the payout-rails readiness gate:

- how do we turn `NOT_READY` blockers into operational proof without adding payout rails?

It does **not** implement:

- payout rails
- payout execution
- public portal discovery
- marketplace behavior
- finance-platform behavior

## Current foundation already present

Current main already has:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry and attribution views
- PR14 manual settlement workflow + payout profile foundation
- PR15 invited contributor portal light
- PR16 program catalog + terms + application intake
- PR17 application review queue + invite issuance refinement
- PR18 payout-rails readiness gate

That means the next missing layer is no longer structure.
It is operational proof.

## Why proof pack is the next missing layer

PR18 can now say whether payout rails are worth evaluating.

But current local/demo posture still stays `NOT_READY` when:

- payout profiles are not actually filled
- settlement history has not actually been exercised
- exported / closed batch evidence does not exist
- invited / active participant posture is still missing

So PR19 should not widen platform scope.
It should do three narrower things:

1. make the blockers operationally visible
2. seed a minimum believable proof pack in local/demo data
3. freeze the resulting truth in docs and guards

## Proposed scope

### 1. Settlement ops proof helper

Add a narrow derived helper that summarizes:

- required beneficiary coverage
- active payout profile coverage
- invited / active participant coverage
- batch history
- exported / closed evidence
- export-backed manual completion evidence
- paid-without-export anomalies as an explicit operator audit move
- next recommended operator moves

### 2. Internal settings visibility

Add a narrow settings / billing card that explains:

- who still lacks payout profile coverage
- who still lacks participant access coverage
- what proof has already been accumulated
- what the next operational step is

This remains internal-only.

### 3. Seeded proof pack

Use current-main-friendly local seed data to create the minimum believable proof set:

- at least one real payout-profile-backed beneficiary
- at least one invited participant access
- at least one exported / closed settlement batch
- at least one export-backed paid / reversed settlement completion line

This is not a production claim.
It is local/demo evidence so the workflow can be exercised honestly.

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add the proof-pack helper and local/demo seeded operational evidence.

### Phase 2

Expose proof-pack visibility in settings / billing.

### Phase 3

Freeze the baseline and acceptance docs, update discoverability, and add tiny truthfulness guards.

## Preserved boundaries

PR19 must continue to preserve:

- no payout rails
- no payout execution
- no public portal
- no marketplace
- no full finance console
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

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

PR19 does **not** implement:

- payout rails
- bank / wallet transfer
- invoice / tax / retry / dunning
- public partner portal
- public marketplace
- ranking / discovery
- full finance console
- full RBAC builder
- multi-workspace

## Target outcome

When PR19 is done, current main should be able to truthfully say:

- the payout-rails readiness blockers are now operationally visible
- local/demo data can exercise one believable settlement proof path
- the gate is backed by actual settlement evidence rather than structure alone
- payout still remains manual / off-platform
