---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Settlement Exception Handling Plan v1

## Purpose

This document freezes PR20:
Settlement Reversal / Exception Handling Polish.

PR20 answers one narrow follow-up to PR19:

- now that settlement proof exists, how do we make reversals and settlement exceptions operationally readable without turning Helm into a finance platform?

PR20 does **not** implement:

- payout rails
- payout execution
- public portal settlement controls
- marketplace behavior
- finance-platform behavior

## Current foundation already present

Current main already has:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry and attribution visibility
- PR14 manual settlement workflow + payout profile foundation
- PR15 invited contributor portal light
- PR16 program catalog + terms + application intake
- PR17 application review queue + invite issuance refinement
- PR18 payout-rails readiness gate
- PR19 settlement operations proof pack

That means the next missing layer is not structure or readiness proof.
It is settlement exception handling.

## Why exception handling is the next missing layer

Current main can already:

- create settlement batches
- export them
- mark lines paid
- reverse lines
- close batches

But the system still needs a narrower operating layer that keeps the following readable:

- which settlement lines are blocked by missing or inactive payout profile posture
- which beneficiary scopes are settlement-capable but have suspended / archived participant posture
- which exported lines still need manual completion
- which reversals already happened and why
- which transitions should be blocked because the line posture is no longer valid

PR20 should tighten that operational truth without widening into payout execution or a finance console.

## Proposed scope

### 1. Transition guard polish

Tighten manual settlement so:

- only exported lines can be marked paid
- already reversed lines cannot be paid again
- reversal posture remains explicit and manual

### 2. Settlement exception helper

Add a narrow derived helper that summarizes:

- missing payout profile exceptions
- inactive payout profile exceptions
- suspended / archived participant access exceptions
- exported-but-not-settled line exceptions
- paid-without-export anomalies
- reversal history
- next operator moves

### 3. Internal settings visibility

Add a narrow internal settlement exceptions / reversals view inside settings / billing that keeps the following readable:

- open exceptions
- recent reversals
- exported-but-not-settled posture
- next operator actions

This remains internal-only.

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add transition guard polish and the settlement exceptions helper.

### Phase 2

Expose settlement exception / reversal visibility in settings / billing.

### Phase 3

Freeze the baseline and acceptance docs, update discoverability, and add tiny truthfulness guards.

## Preserved boundaries

PR20 must continue to preserve:

- no payout rails
- no payout execution
- no public portal settlement controls
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

PR20 does **not** implement:

- payout rails
- bank / wallet transfer
- invoice / tax / retry / dunning
- public portal settlement management
- marketplace
- full finance console
- full RBAC builder
- multi-workspace

## Target outcome

When PR20 is done, current main should be able to truthfully say:

- settlement reversals stay manual and readable
- exported / blocked / inconsistent settlement posture is operationally visible
- invalid paid transitions are prevented
- payout still remains off-platform/manual
