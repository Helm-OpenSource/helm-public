---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Trial Onboarding / Self-Serve Signup Sprint 1 Report

## Scope

This sprint takes Helm from demo-first access toward a real self-serve trial path.

It does not widen Helm into:

- a growth platform
- an onboarding automation platform
- a finance console
- a marketplace

## What landed

- public self-serve signup on the landing experience
- signup-created organization
- default owner membership
- automatic `BillingAccount / TrialState / WorkerEntitlement` foundation bootstrap
- active organization session on signup
- `/setup` as the first self-serve onboarding surface
- clearer trial / grace / read-only messaging
- docs / guards / tests / self-check alignment for this path

## Answers

### 1. Is self-serve signup truth now clear?

Yes.

Current-main now clearly says:

- a new user can start from the public landing
- signup creates one organization
- the first user becomes `OWNER`
- trial starts immediately
- default seats and included core workers are attached automatically

### 2. Does signup -> organization -> trial runtime now exist?

Yes.

The runtime chain now creates:

- `User`
- `Workspace`
- `Membership`
- `BillingAccount`
- `TrialState`
- included core `WorkerEntitlement`
- active organization session cookies

So new users no longer need a demo account to enter a real organization-scoped runtime.

### 3. Does the trial onboarding surface now exist?

Yes.

`/setup` now acts as the first self-serve onboarding surface for non-demo trial organizations and answers:

- current organization
- current role
- trial state
- trial end date
- grace rule
- seat posture
- included core workers
- next three actions
- purchase / restore path

### 4. Are lifecycle messaging and upgrade paths now clear?

Yes, at the v1 product level.

Trial, grace, and read-only now explain:

- what remains available
- what narrows
- why
- where purchase or restore happens

The messaging stays lifecycle-first instead of finance-console-first.

### 5. Does Helm still depend on demo entry for trial experience?

No.

Demo remains available for founder / sales / recruiter storytelling, but it is no longer the only practical way to get into Helm.

### 6. Are foundation + payment + onboarding now enough for real self-serve trial?

`conditional-go`

The product path is now real enough for self-serve trial:

- signup works
- trial runtime works
- billing foundation is attached
- payment restore / purchase paths remain visible

It is still not a full PLG stack because email verification, nurture, and growth automation remain intentionally out of scope.

### 7. Did recommendation / commitment A-minus lines stay stable?

Yes.

This sprint only added the new-user runtime path and onboarding explanation layer. It did not widen recommendation or commitment semantics.

### 8. What was intentionally not done, and why?

- no SSO / SCIM
- no multi-workspace onboarding
- no finance console
- no email verification / nurture automation
- no full onboarding platform
- no feature-gated trial
- no token / storage customer-visible quota model

These were intentionally left out to keep the sprint narrow and truthful.

### 9. What are the next 5 highest-value follow-ups?

1. Add invite-acceptance polish so invited members can enter the new organization path more smoothly.
2. Add a small welcome dataset / guided empty-state layer for non-demo self-serve organizations.
3. Tighten settings and dashboard handoff so first-time users see clearer “what to do next” cues after setup.
4. Add narrow email verification or session-hardening without turning Helm into a full auth platform.
5. Add more explicit upgrade / restore messaging on dashboard and billing overview for grace and read-only states.

## Preserved boundaries

- trial and paid still keep the full current core product
- token / storage / retrieval stay internal-only
- no finance console
- no worker marketplace
- no connector marketplace
- no enterprise provisioning platform
- no second app tree

## Acceptance note

Self-serve trial onboarding is now a real current-main product path rather than only a future commercial intention.
