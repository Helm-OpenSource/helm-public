---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rail Pilot Cohort Baseline v1

## Purpose

This document freezes PR22:
Payout Rail Pilot Cohort + Operator Readiness Pack.

It answers one narrow current-main question:

- once Helm has a truthful pilot spec, can operators now select one narrow cohort and rehearse the first off-platform dry run without overclaiming payout execution?

This baseline does **not** implement payout rails.
It freezes the internal cohort-selection and operator-readiness layer before any payout execution PR starts.

## Current truth

Current main already had:

- a payout-rails readiness gate
- a payout rail pilot spec
- a settlement operations proof pack
- a settlement exception / reversal layer

PR22 adds the next missing internal operator layer:

- a pilot cohort gate
- an operator readiness pack
- a frozen dry-run export contract
- explicit no-go / rollback triggers

## What now exists

### 1. Pilot cohort gate exists

Current main can now summarize:

- how many beneficiary cohorts are even eligible for a pilot discussion
- how many are already narrow enough for a dry run
- whether operators should keep holding manual posture
- whether operators should choose one beneficiary class
- whether one cohort is already ready for operator dry run

The possible top-level states are:

- `HOLD_MANUAL`
- `READY_TO_SELECT_COHORT`
- `READY_FOR_OPERATOR_DRY_RUN`

### 2. Operator readiness pack exists

Inside internal settings / billing, operators can now see:

- eligible cohorts
- ready cohorts
- recommended beneficiary class
- recommended currency
- recommended payout method label
- cohort-by-cohort coverage, settlement-cycle, completion, reversal, and exception counts

This pack stays internal-only.
It does **not** turn settings into a payout platform or finance console.

### 3. Dry-run export contract exists

PR22 freezes the first dry-run export contract fields:

- beneficiary
- beneficiary type
- source type
- amount
- status
- notes/reference

This is only an off-platform dry-run contract.
It does **not** connect payment APIs or execute payout.

### 4. Go / no-go and rollback triggers exist

Current main now explicitly preserves no-go / rollback triggers such as:

- profile mismatch against exported lines
- beneficiary scope confusion across classes
- exports that cannot be reconciled back into settlement posture
- reversal ambiguity that can no longer be handled manually

### 5. Manual settlement remains the fallback source of truth

Even when one cohort is ready for operator dry run:

- manual settlement remains the fallback source of truth
- manual approval remains required
- manual rollback remains possible
- payout execution still does not exist

## Operator checklist truth

PR22 freezes one internal operator checklist around:

- readiness gate already green
- CN-only scope
- one beneficiary class
- one payout method label
- one currency
- full payout-profile coverage
- full participant-access coverage
- at least two settlement cycles
- both completion and reversal evidence
- no open exceptions

If these are not simultaneously true for one cohort, current main should stay manual-first.

## Preserved boundaries

Current main still preserves all of the following:

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

## Explicitly deferred

PR22 does **not** add:

- payout rails
- bank / wallet disbursement
- automatic settlement execution
- public portal settlement controls
- marketplace behavior
- partner ranking / discovery
- full finance console

## Freeze summary

The payout rail pilot cohort gate exists.
The operator readiness pack exists.
The dry-run export contract exists.
The no-go / rollback checklist exists.
Current main can now tell operators whether one narrow cohort is ready for an off-platform dry run, while manual settlement remains the fallback source of truth and payout execution still does not exist.
