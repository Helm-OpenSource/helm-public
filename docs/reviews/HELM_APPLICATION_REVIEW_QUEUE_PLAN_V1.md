---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Application Review Queue + Invite Issuance Plan v1

## Purpose

This document freezes the PR17 rollout plan for the next narrow participation layer after:

- PR11 billing foundation
- PR12 revenue attribution foundation
- PR13 contributor / partner registry
- PR14 manual settlement
- PR15 invited participant portal light
- PR16 program catalog + terms + application intake

PR17 adds the next missing operational layer:

- application review becomes a real internal queue
- accepted applications can move into invite issuance through the same seam
- issued invites are linked back to their source application

It intentionally does **not** widen Helm into:

- payout rails
- a public marketplace
- automatic portal access
- a broader admin platform
- a workflow engine

## Current foundation already present

Current main already has:

- organization / membership / billing lifecycle
- revenue rules, attribution, payout-ledger posture, and manual settlement
- worker publisher / sales referral / custom engagement registry
- invited participant portal onboarding and self-only earnings visibility
- public program catalog, terms versioning, and controlled application intake

That means PR17 does not need:

- a second app tree
- a route-owner rewrite
- shell thinning
- a marketplace
- a new admin console

It should extend current-main through the existing seams:

- `prisma/schema.prisma`
- `features/programs/*`
- `features/participant-portal/*`
- `features/settings/*`
- docs / guards / tests

## Why application review queue + invite issuance is the next missing layer

Current main can already answer:

- what programs exist
- what rules apply
- who submitted an application
- how invited participants onboard and view their own earnings

But it still cannot make the full internal flow operationally tight:

- review and invite issuance are still two disconnected admin steps
- applications do not yet link to the beneficiary / portal access they produced
- the settings review list is visible, but not yet a true "review queue -> issue invite" seam

That is the exact gap PR17 closes.

## Objects already present vs behavior still missing

Already present:

- `PartnerProgram`
- `ProgramTermsVersion`
- `ProgramApplication`
- `ParticipantPortalAccess`
- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`

Still missing before PR17:

- application-to-invite linkage
- application-backed beneficiary creation / reuse
- a truthful "accepted -> invited" operational step inside settings
- review queue wording and state semantics where `invited` only means invite really issued

## Rollout phases

### Phase 0

Land this plan doc and freeze scope.

### Phase 1

Add the narrow application linkage foundation:

- link `ProgramApplication` to the portal access it issued
- store the beneficiary reference created or reused for the application
- make `invited` mean a real issued invite, not only "ready for invite"

### Phase 2

Add invite issuance refinement:

- issue portal invite directly from an accepted application
- create or reuse the matching beneficiary record using the existing registry objects
- link the created/reused participant portal access back to the application

### Phase 3

Turn the settings list into a true manual review queue:

- queue-focused filters / summaries
- application review status updates
- beneficiary recommendation
- direct invite issuance
- linked portal access visibility

### Phase 4

Clear the two touched e2e red items that were still failing inside the hierarchy suite:

- refresh the stale customer-success queue handoff selector
- revalidate that the queue -> success-check -> customer-success path still behaves correctly after the selector fix

### Phase 5

Freeze the baseline and acceptance docs, update docs discoverability, add narrow truthfulness guards, and close with full validation.

## Preserved boundaries

PR17 must continue to preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no payout rails
- no public marketplace
- no auto-issued partner access without internal admin action
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

- `npm run db:generate`
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

PR17 does **not** implement:

- payout rails
- bank / wallet transfer
- public worker marketplace
- public partner marketplace
- partner ranking / discovery
- public self-signup without review
- automatic portal access after application submission
- full finance console
- full RBAC builder
- multi-workspace participation programs

## Target outcome

When PR17 is done, current main should be able to truthfully say:

- applications can be reviewed inside a controlled internal queue
- accepted applications can produce real invited portal access from the same seam
- issued invites remain reviewable and linked back to the source application
- payout execution and public marketplace behavior remain separate later phases
