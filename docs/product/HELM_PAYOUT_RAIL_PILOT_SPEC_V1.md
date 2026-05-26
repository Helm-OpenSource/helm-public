---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rail Pilot Spec v1

## Purpose

This document freezes PR21:
Payout Rail Pilot Spec.

It answers one narrow current-main question:

- once Helm is `READY_FOR_NARROW_PILOT`, what is the smallest truthful payout-rail pilot worth attempting?

This spec does **not** implement payout rails.
It freezes the decision boundary before any payout execution PR starts.

## Current truth before any pilot starts

Current main already has:

- a billing foundation
- a revenue-attribution foundation
- contributor / partner registry
- manual settlement
- contributor portal light
- program catalog and controlled application intake
- application review queue + invite issuance
- a payout-rails readiness gate
- a settlement operations proof pack
- a settlement exception / reversal layer

That means Helm can already tell whether payout posture is operationally believable.

It still cannot honestly claim:

- payout execution
- bank / wallet transfer
- public settlement portal
- marketplace readiness

## Pilot entry criteria

A real payout-rail pilot should only be evaluated when **all** of the following are true in a live operating cohort, not only in local/demo seed data:

1. the payout-rails readiness gate is `READY_FOR_NARROW_PILOT`
2. there are at least two consecutive manual settlement cycles for the target cohort
3. every beneficiary in the target cohort has an active payout profile
4. the target cohort has no open missing-profile or blocked-participant exceptions at pilot start
5. the target cohort already has manual evidence for both:
   - at least one paid settlement line
   - at least one reversal / reversal-capable settlement case
6. internal operators can already review, export, close, and explain settlement posture without ambiguity

If any of the above is not true, Helm should continue manual settlement first.

## First pilot envelope

The first payout-rail pilot must stay narrow.

It should be limited to:

- one country
- one currency
- one beneficiary class
- one payout method label
- one internal operator group
- one explicitly approved pilot cohort

For current main, the recommended envelope is:

- one domestic pilot only
- CNY only
- one beneficiary class only
- one payout method label only
- manual approval remains required before any rail handoff
- manual settlement remains the fallback source of truth
- manual settlement export remains the fallback source of truth

`READY_FOR_NARROW_PILOT` does not mean “expand to all beneficiary lines”.

## Manual controls that must remain in place

Even in a future pilot, all of the following should remain manual:

- beneficiary approval into the pilot cohort
- batch approval
- exception review
- reversal review
- rail fallback decision
- closeout confirmation

The pilot should not replace the current manual settlement operator layer.
It should sit behind it.

## Pilot success criteria

A future payout-rail pilot should only be considered successful if all of the following stay true:

1. `SettlementBatch` remains the internal source of truth
2. exported, paid, and reversed posture remain readable inside Helm
3. exceptions remain visible in the internal settlement exception view
4. manual fallback remains possible without losing settlement truth
5. the pilot does not widen into public portal settlement, marketplace behavior, or finance-console behavior

## Rollback / no-go triggers

The future pilot should stop or roll back if any of the following appears:

- payout profile mismatch against exported beneficiary lines
- beneficiary scope confusion across classes
- exported lines that cannot be reconciled back into settlement posture
- reversal ambiguity that can no longer be handled manually
- pressure to widen from one beneficiary class to many before the first cohort is stable
- pressure to introduce automatic payout, automatic approvals, or public partner settlement controls

## What this pilot spec does not mean

This spec does **not** mean:

- payout rails already exist
- payout execution is ready now
- public partner settlement is ready
- marketplace readiness exists
- finance-console expansion is justified

It only means Helm now has a narrow answer to:

- if a payout-rail PR ever starts, how small should the first pilot be?

## Preserved boundaries

Current main still preserves all of the following:

- payout remains off-platform/manual today
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

PR21 does **not** add:

- payout rails
- bank / wallet disbursement
- automatic settlement execution
- invoice / tax / retry / dunning
- public partner portal settlement actions
- marketplace
- partner ranking / discovery
- full finance console

## Freeze summary

The payout rail pilot spec now exists.
It defines a narrow pilot entry bar, a one-country / one-currency / one-beneficiary-class envelope, and a manual-first rollback posture.
It does not claim payout execution already exists.
