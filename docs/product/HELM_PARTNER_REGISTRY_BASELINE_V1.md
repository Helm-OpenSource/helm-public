---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Partner Registry Baseline v1

## Purpose

This document freezes PR13:
the contributor / partner registry and attribution-view layer on top of the already-landed billing foundation and revenue-attribution foundation.

PR11 already made Helm commercially operable by organization.
PR12 already made revenue attribution truthful.

PR13 adds the next narrow operational layer:

- worker publishers can be registered and viewed
- sales referrals can be registered and viewed
- custom engagements can be registered and viewed
- attributed revenue and payable-later posture can be reviewed by the right internal roles

This baseline does **not** widen Helm into:

- a payout platform
- a worker marketplace
- a public partner portal
- a full finance console

## Foundation dependency

This baseline sits on top of:

- `HELM_BILLING_FOUNDATION_BASELINE_V1.md`
- `HELM_REVENUE_ATTRIBUTION_BASELINE_V1.md`

It preserves current-main truth:

- `Workspace` remains the v1 organization boundary
- settings remains the current internal commercial visibility seam
- role-gating stays on the fixed v1 membership roles

## Frozen registry scope

Current main now freezes three internal registry objects as operationally usable:

### Worker publisher registry

`WorkerPublisherProfile` is no longer only a persistence object.
It now has an internal registry workflow inside settings / billing:

- create worker publisher profile
- review existing publisher profiles
- filter by status
- update status

This remains:

- internal/admin-readable only
- not a creator portal
- not a marketplace onboarding flow

### Sales referral registry

`SalesReferral` is now operationally visible as an internal registry line:

- create sales referral
- review existing referrals
- filter by status
- update status

It exists to keep referral attribution readable.
It is not a sales portal and not a commission settlement system.

### Custom engagement registry

`CustomEngagement` is now operationally visible as an internal registry line:

- create implementation / maintenance engagement
- review existing engagements
- filter by type and status
- update status

It exists to keep implementation and maintenance attribution readable.
It is not a services ERP, delivery portal, or finance module.

## Frozen attribution visibility scope

Current main now freezes an internal attribution visibility layer that can show:

- beneficiary views by worker publisher / sales referral / custom engagement
- attributed revenue totals
- payable-later totals
- source-type breakdown
- pending / approved / paid / reversed posture
- rule truth:
  - which rule applied
  - whether the rule is recurring or one-time
  - whether reversal may apply

This layer remains:

- internal-only
- admin-readable
- not a payout trigger surface
- not a public partner portal
- not a finance console

## Frozen role-gating truth

The registry and attribution views are only readable for:

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`

Non-admin members remain outside these registry / attribution views.

This is still **not** a full RBAC builder.
It stays on the fixed v1 role model.

## Frozen payable-later truth

`PayoutLedger` remains ledger-only in this phase.

Current main may now show payable-later posture as:

- `pending`
- `approved`
- `paid`
- `reversed`

But PR13 still does **not** add:

- payout rails
- bank / wallet disbursement
- payout trigger buttons
- settlement execution

## Frozen commercial truth

PR13 does not change the accepted PR11 commercial model:

- `30`-day organization trial
- `1` included admin
- `2` trial collaborator seats
- `CNY 199 / month / organization`
- `CNY 99 / active seat / month`
- current first-party core workers included
- token / storage remain internal-only accounting

Registry and attribution views only explain how contribution lines and payable-later posture are tracked internally.

## Frozen boundary truth

PR13 must continue to preserve:

- no new product wedge
- no payout execution
- no worker marketplace
- no public partner portal
- no sales portal
- no full finance console
- no route/query rewrite
- no second app tree
- no shell thinning
- no send authority
- no workflow control

## What this baseline now makes true

Current main can now do all of the following inside Helm:

- register worker publishers
- register sales referrals
- register custom engagements
- review contribution lines in one internal settings seam
- review attributed revenue by beneficiary
- review payable-later posture by beneficiary and status
- keep all of that inside a narrow admin-readable product surface without implying payout execution

## Governance markers (do not remove — `scripts/decision-first-boundary-check.ts`)

These canonical assertions are referenced by the boundary-check script. They live here in the baseline document so the customer-facing UI can stay terse without losing the auditable claim:

- Only owner, billing admin, and admin can read internal contributor registry.
