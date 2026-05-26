---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Add-on Worker Commercial Wiring Sprint 1 Report

## Outcome

`Add-on Worker Commercial Wiring Sprint 1` is accepted as the first reusable commercial wiring layer for worker entitlements.

It does not introduce a marketplace or a live worker purchase flow.
It makes the current entitlement rails easier to explain, demo, and extend later.

## What landed

- included core workers now remain visible as real entitlements
- fresh organizations now also receive reserved add-on worker rails, not only seeded demo orgs
- settings billing overview now distinguishes:
  - included workers
  - active commercial add-on rails
  - reserved monthly rails
  - reserved per-use rails
  - effective-window and internal-limit posture
- per-worker cards now explain:
  - commercial mode
  - commercial truth
  - usage path
  - future path
  - effective window
  - internal limit
- the page now states clearly that this is commercial wiring, not a worker marketplace or worker app store

## Questions

### 1. Is add-on worker commercial truth now clear?

Yes.

Current truth is now explicit:

- core workers stay included
- monthly add-on rails are future recurring commercial rails
- per-use add-on path and per-use rails are future usage-oriented commercial rails
- active / inactive / canceled are operational truth, not a checkout matrix

### 2. Is WorkerEntitlement presentation now more product-grade?

Yes.

The worker section now reads as a commercial overview instead of a raw entitlement dump.

### 3. Can settings now clearly explain included / add-on / per-use?

Yes.

It now explains:

- which rails are included
- which rails are active add-ons
- which rails are reserved for future monthly expansion
- which rails are reserved for future per-use expansion

### 4. Are foundation + payment + entitlement enough to support next-step premium worker commercialization?

Conditionally yes.

The wiring layer is now real enough for later payment and operator work, but the next phase must still stay narrow:

- no marketplace
- no finance console
- no usage billing exposure

### 5. Did the recommendation / commitment A-minus lines remain stable?

Yes.

This sprint stayed inside billing/settings/commercial wording and did not widen recommendation or commitment semantics.

### 6. What was intentionally not done, and why?

Still not done by design:

- live add-on worker checkout
- creator revenue share
- partner payout
- worker marketplace
- entitlement admin platform
- add-on app-store style discovery

These were intentionally deferred to keep the sprint inside a narrow commercial wiring layer.

### 7. What are the next five best follow-ups?

1. Define the first live premium worker purchase path without creating a marketplace.
2. Add a narrow payment binding for monthly add-on worker activation.
3. Add a narrow per-use ledger-to-entitlement explanation for premium worker invocation.
4. Add operator-safe status changes for inactive vs canceled add-on rails.
5. Add tighter demo seeds and walkthrough copy for premium worker commercialization storytelling.

## Preserved boundaries

- no worker marketplace
- no worker app store
- no creator revenue share
- no partner payout rails
- no finance console
- no token / storage / retrieval customer-visible billing
- no Trial / Paid feature crippling

## Validation

Validated with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`
