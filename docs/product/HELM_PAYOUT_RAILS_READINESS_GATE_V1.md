---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Payout Rails Readiness Gate v1

## Purpose

This document freezes the current-main answer to one narrow question:

- when is it worth connecting real payout rails?

It does **not** implement payout execution.
It freezes an internal-only gate on top of the already-landed billing, attribution, registry, manual-settlement, contributor-portal, program-catalog, and application-review foundations.

## What the readiness gate now does

Current main now has a payout-rails readiness gate that derives a go / no-go posture from existing operational evidence only.

The gate is based on:

1. payout profile coverage
2. settlement batch history
3. exported / closed batch evidence
4. export-backed paid / reversed manual completion evidence
5. invited / active participant posture
6. current-batch missing-profile risk

This is an internal-only go/no-go view.
It does not expose payout execution, a public portal, or marketplace readiness.

## Gate statuses

### `NOT_READY`

Use this when one or more hard blockers are still open:

- no active payout profiles
- no settlement batch history
- no exported / closed settlement evidence
- current batch still has missing payout profiles

### `CONDITIONAL_GO`

Use this when the manual-settlement foundation exists, but operating proof is still thin.

Typical watchpoints:

- no paid / reversed completion evidence yet
- no invited / active participant evidence yet
- paid lines still exist without exported evidence and should be audited first

This posture still means payout should remain manual / off-platform.

### `READY_FOR_NARROW_PILOT`

Use this only when:

- active payout profiles exist
- settlement batch history exists
- exported / closed batches exist
- export-backed manual completion evidence exists
- participant posture exists
- current batch no longer has missing payout-profile blockers

This status only means a future narrow payout-rail pilot can be evaluated.
It does not mean payout execution already exists.

## Internal settings surface

Current settings / billing now shows:

- current readiness status
- active payout profile count
- settlement batch count
- exported / closed batch evidence
- manual completion line count
- paid-without-export anomaly count
- invited / active participant count
- current missing-profile blockers
- blocker list
- watchpoint list

This keeps the decision visible to `OWNER`, `BILLING_ADMIN`, and `ADMIN`, while staying separate from a finance console.

## Preserved boundaries

Current main still preserves all of the following:

- payout remains off-platform/manual
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

This gate does **not** implement:

- payout rails
- bank / wallet disbursement
- invoice / tax / retry / dunning
- partner self-serve settlement execution
- public marketplace
- public finance console

## Freeze summary

The payout-rails readiness gate exists.
It is internal-only, evidence-based, and intentionally conservative.
It helps answer whether a future payout-rail PR is worth starting, without claiming payout execution already exists.
