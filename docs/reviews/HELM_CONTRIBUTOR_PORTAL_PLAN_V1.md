---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Contributor Portal Plan v1

## Purpose

This document freezes the PR15 rollout plan for the first external-facing participation layer on top of the already-landed commercial foundations.

PR11 already made Helm commercially operable by organization.
PR12 already made attribution and payable-later truth structured.
PR13 already made internal contributor / partner registry and attribution views operationally readable.
PR14 already made manual settlement operationally usable inside Helm.

PR15 adds the next narrow layer:

- contributors and partners can enter through a controlled onboarding path
- they can complete a basic profile
- they can see their own attributed earnings and payout status

It is intentionally narrow.
It does **not** widen Helm into:

- payout rails
- a public worker marketplace
- a public partner marketplace
- a finance console

## Current foundation already present

Current main already has:

- billing account and lifecycle state
- worker publisher / sales referral / custom engagement registry
- revenue rule / attribution ledger / payout ledger
- beneficiary payout profile foundation
- manual settlement batch and CSV/manual export
- internal admin-readable registry / attribution / settlement visibility

That means PR15 does not need:

- a second app tree
- a billing rewrite
- a broader governance platform

It should extend the existing foundation through current-main-friendly seams:

- `prisma/schema.prisma`
- `lib/auth/*`
- `lib/billing/*`
- `features/settings/*`
- `app/*`
- docs / guards

## Why self-serve onboarding + earnings visibility is the next missing participation layer

Current main can already answer, internally:

- who is credited
- what is payable later
- what payout profile information is on file
- what has entered manual settlement

But it still cannot yet answer, externally and in a controlled way:

- how a worker contributor or partner enters Helm for their own participation scope
- how they confirm their profile and payout basics
- how they view only their own attribution and payout posture

That is the exact gap PR15 closes.

## Target participant classes

PR15 supports only these participant classes:

- worker contributors
- custom partners
- custom integration / service partners
- sales referrers

These map to existing beneficiary types:

- `WORKER_PUBLISHER`
- `CUSTOM_SERVICES`
- `SALES_REFERRAL`

## Proposed scope objects

PR15 adds one narrow access / onboarding object layer on top of existing beneficiary and payout-profile objects.

### ParticipantPortalAccess

A controlled participant-access record used to answer:

- which external participant is allowed to enter
- which beneficiary scope they belong to
- whether they are invited / active / suspended / archived
- whether they accepted contribution/partner terms

This object should support:

- invitation / access token onboarding
- one participant scope per beneficiary record
- linking to a real `User`

It is **not** a public signup directory or marketplace listing.

### Existing objects reused

PR15 must reuse:

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `BeneficiaryPayoutProfile`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `SettlementBatchLine`

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add onboarding entry and profile completion:

- accept invitation / access token
- complete basic profile fields
- accept contribution/partner terms acknowledgement
- submit or edit payout profile basics
- show invited / active / suspended / archived status

### Phase 2

Add earnings portal light:

- identity / role summary
- attributed revenue summary
- payout-later summary
- pending / approved / exported / paid / reversed status breakdown
- source-type breakdown
- manual settlement timing note

### Phase 3

Add role and visibility gating:

- owner / billing-admin / admin keep internal registry and settlement views
- contributors/partners see only their own portal scope
- normal product members do not gain registry / settlement visibility

### Phase 4

Freeze the baseline and acceptance docs, update docs discoverability, and add tiny truthfulness guards if needed.

## Preserved boundaries

PR15 must continue to preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no send authority
- no workflow control
- no payout rails
- no bank / wallet transfer
- no public marketplace
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

PR15 does **not** implement:

- payout rails
- bank / wallet transfer
- tax / invoice / retry / dunning systems
- public worker marketplace
- public partner marketplace
- ranking / discovery
- contribution equity logic
- full finance console
- SSO / SCIM
- full RBAC builder
- multi-workspace

## Target outcome

When PR15 is done, current main should be able to truthfully say:

- contributors and partners can onboard in a narrow self-serve way
- they can complete a basic profile and payout basics
- they can see only their own attributed earnings and payout statuses
- internal admin views remain stronger and separate

Without claiming:

- payout execution
- marketplace readiness
- full finance operations
