---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Settlement Operations Proof Pack Baseline v1

## Purpose

This document freezes PR19:
Settlement Operations Proof Pack.

It answers one narrow current-main question:

- how do we turn payout-readiness blockers into real operating proof before any payout-rail work starts?

This baseline does **not** implement payout rails or payout execution.

## What now exists

Current main now has a settlement operations proof pack that adds one internal-only layer on top of the already-landed payout-profile, attribution, participant-access, and manual-settlement foundations.

That proof pack now makes four things true:

1. settlement blockers are operationally visible
2. local/demo data can exercise a believable proof path
3. settings / billing can show what evidence still exists vs what is still missing
4. the payout-rails readiness gate can rely on actual settlement evidence rather than structure alone

## Proof-pack scope

### 1. Settlement operations proof summary

Current main now derives a narrow summary for:

- beneficiary scopes that should be settlement-capable
- active payout-profile coverage
- invited / active participant-access coverage
- settlement batch history
- exported / closed batch evidence
- export-backed paid / reversed manual completion evidence
- paid-without-export audit pressure when a line was marked paid without exported evidence
- next operator moves

### 2. Internal settings visibility

Current settings / billing now shows an internal-only settlement operations proof pack card that keeps the following readable:

- missing payout-profile coverage
- missing participant-access coverage
- export-backed manual completion evidence
- paid-without-export anomalies that still need audit before they can be treated as credible completion proof
- next proof actions

This is intentionally an operator layer.
It does not turn settings into a finance platform.

### 3. local/demo settlement proof path

Current local/demo seed data now includes a minimum believable proof path:

- active payout profiles for settlement-capable beneficiary scopes
- invited participant access for those beneficiary scopes
- historical settlement batch evidence
- exported / closed batch evidence
- paid and reversed line evidence
- an approved current-period batch to keep ongoing manual review visible

This is local/demo operational proof only.
It is not a production claim.

## Why this matters

PR18 already made it possible to ask:

- when is it worth evaluating a narrow payout-rail PR?

PR19 now makes that gate more honest, because the answer can be backed by:

- real payout-profile coverage
- real participant-access coverage
- real settlement-batch history
- real export-backed paid / reversed manual completion evidence

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

PR19 does **not** add:

- payout rails
- bank / wallet disbursement
- invoice / tax / retry / dunning
- public portal
- marketplace
- partner discovery / ranking
- full finance console

## Freeze summary

The settlement operations proof pack exists.
It is internal-only, local/demo-backed, and intentionally narrow.
It makes payout-readiness blockers visible, creates a believable manual-settlement proof path, and still keeps payout off-platform/manual.
