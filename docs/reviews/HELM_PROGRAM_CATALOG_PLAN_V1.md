---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Program Catalog + Terms + Application Intake Plan v1

## Purpose

This document freezes the PR16 rollout plan for the next narrow commercial layer after:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry
- PR14 manual settlement
- PR15 invited self-serve contributor portal

PR16 adds the next missing layer:

- external people can understand which participation programs exist
- they can read the current rule surface
- they can submit an application
- internal admins can review applications inside the current settings seam

It intentionally does **not** widen Helm into:

- payout rails
- a public marketplace
- a partner discovery network
- a legal automation engine
- a broader governance platform

## Current foundation already present

Current main already has:

- organization / membership / billing lifecycle
- revenue rules, attribution, and payable-later ledgers
- worker publisher / sales referral / custom engagement registry
- manual settlement workflow
- invited participant onboarding and self-only earnings visibility

That means PR16 does not need:

- a second app tree
- a route-owner rewrite
- a shell-thinning pass
- a marketplace

It should extend current-main through the existing seams:

- `prisma/schema.prisma`
- `lib/billing/*`
- `features/settings/*`
- `app/*`
- docs / guards

## Why catalog + terms + application intake is the next missing layer

Current main can already answer, internally:

- who can be credited
- what is attributable
- what may be payable later
- how invited participants enter and view their own earnings

But it still cannot answer, externally and in a controlled way:

- what participation programs exist
- who each program is for
- where revenue comes from
- what rules apply
- how someone applies to join

That is the exact gap PR16 closes.

## Objects already present vs behavior still missing

Already present:

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `BeneficiaryPayoutProfile`
- `ParticipantPortalAccess`

Still missing before PR16:

- `PartnerProgram`
- `ProgramTermsVersion`
- `ProgramApplication`
- public program catalog pages
- public terms/rules surface
- controlled application intake
- internal application review list

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add the program/terms/application foundation:

- `PartnerProgram`
- `ProgramTermsVersion`
- `ProgramApplication`
- default v1 seeds for:
  - Worker Publisher Program
  - Custom Partner Program
  - Sales Referral Program

### Phase 2

Add the public catalog and application intake:

- public catalog list
- public program detail pages
- visible terms/rules surface
- controlled application submission

### Phase 3

Add the internal admin-readable application review seam:

- `Admin Review Seam`

- review application list
- status updates:
  - `submitted`
  - `accepted`
  - `rejected`
  - `waitlisted`
  - `invited`
- recommended beneficiary type
- terms version visibility

### Phase 4

Freeze the baseline and acceptance docs, update docs discoverability, and add narrow truthfulness guards.

## Preserved boundaries

PR16 must continue to preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no payout rails
- no public marketplace
- no partner ranking / discovery
- no full finance console
- no send authority
- no workflow control

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

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## Explicitly deferred

PR16 does **not** implement:

- payout rails
- bank / wallet transfer
- public worker marketplace
- public partner marketplace
- partner ranking / discovery
- full finance console
- full legal automation
- SSO / SCIM
- full RBAC builder
- multi-workspace participation programs

## Target outcome

When PR16 is done, current main should be able to truthfully say:

- external participants can understand available programs
- they can read the current rule surface
- they can submit controlled applications
- internal admins can review those applications
- invite issuance and payout execution still remain separate later phases
