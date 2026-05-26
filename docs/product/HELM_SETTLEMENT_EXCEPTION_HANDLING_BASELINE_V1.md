---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Settlement Exception Handling Baseline v1

## Purpose

This document freezes PR20:
Settlement Reversal / Exception Handling Polish.

It answers one narrow current-main question:

- once manual settlement exists, how do we keep exported, blocked, inconsistent, or reversed settlement posture operationally readable?

This baseline does **not** implement payout rails or payout execution.

## What now exists

Current main now has a settlement exception handling layer on top of the already-landed manual settlement workflow.

That layer now makes four things true:

1. settlement exceptions are internally readable
2. reversals remain explicit and visible
3. invalid paid transitions are prevented
4. settings / billing can show operator next moves without becoming a finance platform

## Scope

### 1. Transition guard polish

Current main now keeps settlement transitions narrower:

- only exported lines can be marked paid
- reversed lines cannot be marked paid again
- reversal posture remains explicit and manual

### 2. Settlement exception summary

Current main now derives a settlement exception summary for:

- missing payout profiles
- inactive payout profiles
- suspended / archived participant access posture
- exported-but-not-settled lines
- paid-without-export anomalies
- recent reversal evidence
- next operator moves

### 3. Internal settings visibility

Current settings / billing now shows an internal-only settlement exceptions / reversals view that keeps the following readable:

- open exceptions
- recent reversals
- exported-but-not-settled posture
- next operator actions

This is intentionally an operator layer.
It does not turn settings into a finance platform.

## Why this matters

PR19 already made payout-readiness proof more real.

PR20 now makes the manual settlement layer more honest by showing:

- what is still blocked
- what has already been reversed
- what still needs a manual completion update
- which transitions should no longer be accepted

## Preserved boundaries

Current main still preserves all of the following:

- payout remains off-platform/manual
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

PR20 does **not** add:

- payout rails
- payout execution
- bank / wallet disbursement
- invoice / tax / retry / dunning
- public portal settlement controls
- marketplace
- full finance console

## Freeze summary

settlement exception handling exists.
It is internal-only, manual, and operator-readable.
It keeps reversals explicit, makes exported / blocked settlement posture visible, and still stops well before payout execution.
