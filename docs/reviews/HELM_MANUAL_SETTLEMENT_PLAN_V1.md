---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Manual Settlement Plan v1

## Purpose

This document freezes the PR14 rollout plan for the next narrow commercial layer on top of the already-landed billing, revenue-attribution, and partner-registry foundations.

PR14 adds the missing operational layer between:

- internal payable-later attribution truth
- and any future payout rail work

It is intentionally narrow:

- collect beneficiary payout profile information
- group payable lines into settlement batches
- review and approve a batch internally
- export a batch for off-platform payment
- mark lines as exported / paid / reversed

It does **not** widen Helm into:

- a payout rail
- an external portal
- a marketplace
- a finance console

## Current foundation already present

Current main already includes:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry and attribution views

That means Helm already has:

- `Workspace` as the organization boundary
- fixed membership roles and billing roles
- billing account and lifecycle state
- worker publisher / sales referral / custom engagement objects
- revenue rule / attribution ledger / payout ledger
- narrow internal attribution visibility inside settings / billing

So PR14 is not a rewrite.
It is the next narrow operational step: turning payable-later ledger truth into a manual settlement workflow.

## Why manual settlement is the next missing operational layer

Current main can already answer:

- where revenue came from
- who should be credited
- which rule applies
- what could become payable later

But it still cannot yet operationally answer:

- does this beneficiary have payout profile information on file
- which payable lines belong in this month’s settlement run
- which batch has been internally approved
- which lines were exported for off-platform settlement
- which lines were later marked paid or reversed

That is the exact gap PR14 closes.

## Proposed objects

### BeneficiaryPayoutProfile

A narrow internal payout-profile record for these beneficiary classes:

- worker publisher
- sales referral beneficiary
- custom engagement beneficiary

Minimum fields:

- workspace
- beneficiary type
- beneficiary reference
- display / legal name
- contact
- payout method label
- payout details reference or notes
- invoice required yes / no
- status
- notes

### SettlementBatch

A workspace-scoped settlement batch for a settlement period.

Minimum fields:

- workspace
- batch key
- period label / period window
- currency
- status: `draft | approved | exported | closed`
- notes

### SettlementBatchLine

A narrow join between `SettlementBatch` and `PayoutLedger`.

Minimum fields:

- settlement batch
- payout ledger line
- beneficiary
- source type
- amount
- status: `pending | approved | exported | paid | reversed`
- notes / reference

## Rollout phases

### Phase 0

Create this plan doc and freeze the scope.

### Phase 1

Add beneficiary payout profile foundation.

### Phase 2

Add settlement batch objects and manual lifecycle logic:

- create batch for a period
- collect eligible payout lines
- review totals by beneficiary / source type
- approve lines
- mark batch exported
- mark lines paid
- reverse lines if needed

### Phase 3

Add narrow internal settlement views inside settings / billing:

- current batch
- beneficiary totals
- source-type totals
- line status views
- payout-profile presence / missing-profile warnings

### Phase 4

Add simple CSV/manual export for settlement batches.

### Phase 5

Freeze the baseline and acceptance docs, update docs discoverability, and add tiny truthfulness guards if needed.

## Preserved boundaries

PR14 must continue to preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no send authority
- no workflow control
- no payout rails
- no automatic bank / wallet transfer
- no public partner portal
- no worker marketplace
- no sales portal
- no full finance console
- no broader governance/admin platform

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

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## Explicitly deferred

PR14 does **not** implement:

- actual payout rails
- bank / wallet transfer
- tax / invoice / retry / dunning systems
- public partner portal
- worker marketplace
- sales portal
- partner self-serve onboarding
- contribution equity logic
- full finance console
- SSO / SCIM
- full RBAC builder
- multi-workspace

## Target outcome

When PR14 is done, current main should be able to truthfully say:

- beneficiary payout profiles exist
- settlement batches exist
- internal monthly settlement can be reviewed
- settlement batches can be exported for off-platform payment
- lines can be marked exported / paid / reversed

Without claiming:

- automated payout execution
- external beneficiary access
- marketplace readiness
- full finance operations
