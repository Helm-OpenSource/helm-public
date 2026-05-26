---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Revenue Attribution Acceptance Report v1

## Scope

This report records acceptance for PR12:
the contribution / revenue-attribution foundation for Helm on top of the already-landed billing foundation.

It was evaluated as:

- an attribution-layer foundation PR
- an internal operator-readability PR

It was **not** evaluated as:

- a payout rail PR
- a partner portal PR
- a finance console PR
- a worker marketplace PR

## Phases completed

### Phase 0

Completed:

- confirmed PR11 billing foundation is already present in current main
- confirmed attribution is the next missing layer
- landed `HELM_REVENUE_ATTRIBUTION_PLAN_V1.md`

### Phase 1

Completed:

- added `WorkerPublisherProfile`
- added `SalesReferral`
- added `CustomEngagement`
- added `RevenueRule`
- added `RevenueAttributionLedger`
- added `PayoutLedger`
- added Prisma migration and client generation support

### Phase 2

Completed:

- added attribution math for:
  - fixed percent
  - fixed amount
- added one-time and recurring rule support
- added reversal support for refund / cancel paths
- added foundation bootstrap for default platform / worker / custom attribution rules

### Phase 3

Completed:

- added minimal internal visibility in settings / billing
- exposed:
  - revenue source type
  - beneficiary
  - split rule posture
  - payable-later amount
  - pending / approved / paid / reversed status
- kept the surface internal-only and non-executable

### Phase 4

Completed:

- added this acceptance report
- added the baseline freeze doc
- updated docs discoverability

## What landed

The following are now real current-main attribution foundations:

- worker-publisher beneficiary profiles
- sales referral attribution records
- custom engagement attribution records
- reusable revenue rules
- attribution ledger lines
- payable-later ledger lines
- settings billing visibility for internal attribution truth

The system can now attribute revenue across:

- platform base fee
- additional active seats
- add-on worker revenue
- custom implementation revenue
- custom maintenance revenue
- sales referral revenue

The system can also record payable-later amounts without implementing payout execution.

## What remained deferred

Still deferred by design:

- payout rails
- payout trigger buttons
- partner settlement flows
- worker marketplace
- partner portal
- invoice generation
- taxes
- retry / dunning
- finance console
- full RBAC builder
- multi-workspace

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route-owner rewrite
- no query rewrite
- no worker marketplace
- no broader admin / finance platform
- no send authority
- no workflow control
- no overclaim of payment or payout readiness

## Validation results

Validated on current main plus PR12 changes:

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run self-check` — passed
- `npm run check:boundaries` — passed
- `npm run build` — passed
- `npm run test` — passed

## Acceptance outcome

`go`

Reasons:

- attribution objects are now real
- split rules are now real
- payable-later records are now real
- settings can read attribution truth without turning into a payout console
- no unrelated platform or workflow scope was mixed in

## Readiness for a future payout integration PR

`conditional-go`

The foundation needed for a future payout-oriented PR is now present:

- beneficiary profiles exist
- rules exist
- attribution ledger exists
- payable-later ledger exists

But payout readiness is still intentionally incomplete because current main still does **not** include:

- payout rail execution
- beneficiary onboarding
- settlement operations
- payout approval workflows

So a later payout PR can start from this accepted foundation, but it must remain narrow and truthful.
