---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Manual Settlement Baseline v1

## Purpose

This document freezes PR14:
the manual settlement workflow and payout-profile foundation on top of the already-landed billing, revenue-attribution, and partner-registry foundations.

PR11 already made Helm commercially operable by organization.
PR12 already made attribution and payable-later truth structured.
PR13 already made contributor / partner registry and attribution views operationally readable.

PR14 adds the next narrow operational layer:

- payout profile foundation exists
- settlement batch exists
- internal settlement view exists
- CSV/manual export exists

This baseline does **not** widen Helm into:

- payout rails
- a public portal
- a marketplace
- a finance console

## Foundation dependency

This baseline sits on top of:

- `HELM_BILLING_FOUNDATION_BASELINE_V1.md`
- `HELM_REVENUE_ATTRIBUTION_BASELINE_V1.md`
- `HELM_PARTNER_REGISTRY_BASELINE_V1.md`

It preserves current-main truth:

- `Workspace` remains the v1 organization boundary
- settings remains the current internal commercial visibility seam
- role gating stays on the fixed v1 membership roles

## Frozen payout profile scope

Current main now freezes `BeneficiaryPayoutProfile` as the narrow internal payout-profile layer for:

- worker publisher beneficiaries
- sales referral beneficiaries
- custom engagement beneficiaries

Each payout profile can now keep:

- beneficiary type
- beneficiary reference
- display / legal name
- contact
- payout method label
- payout details reference or notes
- invoice required yes / no
- status
- notes

This remains:

- internal-readable only
- not a public onboarding flow
- not a KYC / tax engine
- not a beneficiary portal

## Frozen settlement batch scope

Current main now freezes a manual monthly settlement workflow around:

### SettlementBatch

`SettlementBatch` groups eligible payable-later lines into a period-based batch.

It now supports this lifecycle:

- `draft`
- `approved`
- `exported`
- `closed`

### SettlementBatchLine

`SettlementBatchLine` is the narrow join between a batch and a payout-ledger line.

It now supports this lifecycle:

- `pending`
- `approved`
- `exported`
- `paid`
- `reversed`

Current main can now:

- create batch for a period
- collect eligible payout lines
- review totals by beneficiary and source type
- approve a batch internally
- mark a batch exported
- mark individual lines paid
- reverse lines manually

This is still manual settlement.
It is not payout execution.

## Frozen settlement visibility scope

Settings / billing may now show a narrow internal settlement readout:

- current batch
- beneficiary totals
- source-type totals
- pending / approved / exported / paid / reversed lines
- payout-profile presence and missing-profile warnings

This must remain:

- internal-only
- admin-readable
- not a public portal
- not a finance console
- not a payout trigger surface beyond narrow manual status updates

## Frozen export truth

Current main now supports CSV/manual export exists for settlement batches.

That export is intentionally narrow:

- beneficiary
- beneficiary type
- source type
- amount
- status
- notes / reference

This export exists only for off-platform/manual settlement handling.

PR14 therefore freezes:

- payout remains off-platform/manual
- no payout rails
- no public portal
- no marketplace

## Frozen role-gating truth

The internal settlement views are only readable for:

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`

This remains the fixed v1 role model.
It is not a full RBAC builder and not a broader governance/admin platform.

## Frozen commercial truth

PR14 does not change the accepted commercial model:

- `30`-day organization trial
- `1` included admin
- `2` trial collaborator seats
- `CNY 199 / month / organization`
- `CNY 99 / active seat / month`
- current first-party core workers included
- token / storage remain internal-only accounting

Manual settlement only makes internal payable-later review operationally usable.
It does not change what the customer is charged.

## Frozen boundary truth

PR14 must continue to preserve:

- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no route/query rewrite
- no payout rails
- no bank / wallet transfer
- no public portal
- no worker marketplace
- no sales portal
- no invoice / tax / retry / dunning system
- no full finance console
- no broader governance/admin platform

## What this baseline now makes true

Current main can now do all of the following inside Helm:

- collect beneficiary payout profile information
- group payable-later lines into settlement batches
- review and approve a monthly batch internally
- export a batch for off-platform/manual payment handling
- mark lines as exported / paid / reversed

Without claiming:

- automated payout execution
- external beneficiary login
- marketplace readiness
- full finance operations

## Governance markers (do not remove — `scripts/decision-first-boundary-check.ts`)

These canonical assertions are referenced by the boundary-check script. They live here in the baseline document so the customer-facing UI can stay terse without losing the auditable claim:

- Only owner, billing admin, and admin can read internal contributor registry.
