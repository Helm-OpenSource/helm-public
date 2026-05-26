---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Revenue Attribution Baseline v1

## Purpose

This document freezes the PR12 contribution / revenue-attribution foundation for Helm v1.

It extends the accepted billing foundation with one narrow question:

- where revenue came from
- who should be credited
- what split rule applies
- what is payable later

It does **not** widen Helm into:

- a payout platform
- a worker marketplace
- a partner portal
- a finance console

## Foundation dependency

This baseline sits on top of:

- `HELM_BILLING_FOUNDATION_BASELINE_V1.md`
- the already-landed organization / membership / trial / billing account model
- the already-landed worker entitlement and usage ledger layer

So PR12 is additive, not a rewrite:

- `Workspace` remains the organization boundary
- `Membership` remains the fixed-role team seam
- settings remains the current-main billing overview surface

## Frozen attribution scope

Current-main attribution now supports these revenue source types:

- `organization base fee`
- `additional active seats`
- `add-on worker revenue`
- `custom implementation revenue`
- `custom maintenance revenue`
- `sales referral revenue`

The purpose is internal truthfulness.
It is not customer-visible billing detail and not public partner settlement logic.

## Frozen attribution objects

### WorkerPublisherProfile

`WorkerPublisherProfile` exists as the internal beneficiary profile for worker-linked revenue attribution.

It is used to answer:

- which worker revenue line should credit which publisher profile
- whether that publisher profile is active or only reserved

Current-main default truth now includes one internal first-party worker publisher profile so included / add-on worker attribution can be grounded without implying a worker marketplace.

### SalesReferral

`SalesReferral` exists as an organization-scoped referral record.

It is used to explain:

- whether a revenue line came through a referral path
- who should be credited on that referral path

It is not a sales portal and not a commission system.

### CustomEngagement

`CustomEngagement` exists as an organization-scoped custom revenue object.

It distinguishes:

- `implementation`
- `maintenance`

It is used to explain where custom-service revenue came from and who would be credited later.

It is not a services ERP or project-finance module.

### RevenueRule

`RevenueRule` is the split-rule layer.

Current-main now supports:

- `one-time split`
- `recurring split`
- `fixed percent`
- `fixed amount`
- `reversal on refund / cancel`

This is the canonical answer to “what split rule applies”.

### RevenueAttributionLedger

`RevenueAttributionLedger` is the internal attribution record.

Each line can now state:

- source type
- source label
- beneficiary type
- beneficiary label
- gross amount
- attributed amount
- pending / approved / paid / reversed status

### PayoutLedger

`PayoutLedger` is the internal payable-later ledger.

It records:

- payable amount
- beneficiary
- status
- optional payable-after / approved / paid / reversed timestamps

It is still only an internal ledger.
There is no payout execution rail.

## Frozen default rule posture

Current-main now freezes these default internal attribution rules per organization / workspace:

- platform recurring split for organization base fee
- platform recurring split for additional active seats
- first-party recurring split for monthly add-on worker revenue
- first-party one-time split for per-use add-on worker revenue
- platform one-time split for custom implementation revenue
- platform recurring split for custom maintenance revenue

Those defaults keep the attribution system immediately usable without claiming:

- creator payout
- partner payout
- live add-on worker commerce

Sales referral attribution remains supported through explicit referral objects and linked rules rather than a generic portal flow.

## Frozen settings visibility scope

Settings / billing may now show a narrow internal attribution readout:

- visible split rules
- revenue source type
- attributed beneficiary
- payable-later amount
- pending / approved / paid / reversed status

This must remain:

- internal/admin-readable
- product-safe
- not a public partner portal
- not a payout trigger surface
- not a finance console

## Frozen commercial truth

PR12 does not change PR11 / payment-layer pricing truth:

- `CNY 199 / month / organization`
- `1` included admin
- `CNY 99 / active user / month`
- current first-party core workers included

Attribution explains how revenue lines are credited internally.
It does not change what the customer is charged.

## Frozen boundary truth

PR12 must continue to preserve:

- no new product wedge
- no route-owner rewrite
- no query rewrite
- no worker marketplace
- no partner portal
- no payout rails
- no invoice engine
- no tax / retry / dunning system
- no send authority
- no workflow control

## What this baseline now makes true

Current main can now answer, in a structured way:

- where revenue came from
- who is credited
- which rule applies
- what is payable later
- whether the line is pending / approved / paid / reversed

Without claiming:

- live payout execution
- partner settlement
- full finance operations
