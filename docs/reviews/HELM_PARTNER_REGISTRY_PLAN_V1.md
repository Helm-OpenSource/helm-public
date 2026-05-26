---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Partner Registry Plan v1

## Purpose

This plan defines PR13:
the contributor / partner registry and attribution-view layer on top of the already-landed billing foundation and revenue-attribution foundation.

PR11 already made Helm commercially operable as an organization-based product.
PR12 already made attribution truth real.

The next missing layer is operational usability:

- contributors / partners can be registered
- their contribution lines can be seen
- attributed revenue and payable-later posture can be reviewed inside Helm

This plan adds that internal registry / visibility layer without widening Helm into:

- a payout platform
- a worker marketplace
- a public partner portal
- a finance console

## Current billing + attribution foundation already present

Current main already has:

- `Workspace` as the v1 organization boundary
- `Membership` with fixed roles
- `BillingAccount`
- `TrialState`
- `WorkerEntitlement`
- `UsageLedger`
- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- settings billing overview with internal attribution visibility

That means PR13 does **not** need to add a new tenant layer, admin app, or commercial engine rewrite.

## Why registry / visibility is the next missing layer

Current main can already model attribution truth, but it is still missing the narrow operational layer that makes that truth usable:

- there is no internal create / edit flow for contributor or partner records
- there is no internal registry workflow for worker publishers, sales referrals, or custom engagements
- attribution is visible, but not yet organized around a practical contributor / partner registry posture
- role-gated internal readability is not yet explicit enough

So PR13 is the step that turns attribution from a backend foundation into a usable internal operating layer.

## Objects already present vs behavior still missing

### Objects already present

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`

### Behavior still missing

- create worker publisher profile
- create sales referral
- create custom engagement
- basic status updates on those records
- list / filter registry records
- role-gated internal visibility for owner / billing-admin / admin

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add the narrowest internal registry behavior for:

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`

That includes:

- create
- basic status update
- list / filter

### Phase 2

Extend settings / billing visibility so internal admin roles can review:

- beneficiary views
- source breakdown
- payable-later posture
- rule / cadence / reversal truth

### Phase 3

Make role-gating explicit for:

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`

Keep non-admin members out of attribution / registry views.

### Phase 4

Freeze the baseline and acceptance docs:

- `HELM_PARTNER_REGISTRY_BASELINE_V1.md`
- `HELM_PARTNER_REGISTRY_ACCEPTANCE_REPORT_V1.md`

And update docs discoverability.

## Preserved boundaries

PR13 must preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no payout rails
- no payment execution
- no worker marketplace
- no public partner portal
- no sales portal
- no full finance console
- no send authority
- no workflow control
- no broader governance / admin platform

Settings may become more operationally useful, but it must still remain:

- internal/admin-readable
- narrow
- product-safe
- not a partner portal
- not a payout console

## Validation contract

After every phase:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

After any real product behavior / view change:

- `npm run build`
- `npm run test`

Final closeout:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## Explicitly deferred

Still deferred by design:

- payout rails
- bank / wallet disbursement
- invoice / tax / retry / dunning systems
- worker marketplace
- public partner portal
- sales portal
- partner self-serve onboarding
- contribution equity logic
- full finance console
- full RBAC builder
- multi-workspace
- SSO / SCIM

## Success standard

PR13 passes only if:

- worker publishers can be registered and viewed
- sales referrals can be registered and viewed
- custom engagements can be registered and viewed
- attribution and payable-later views are visible to the right internal roles
- docs / baseline / acceptance stay honest
- no payout or marketplace behavior is implied
