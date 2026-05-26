---
status: active
owner: helm-core
created: 2026-04-01
review_after: 2026-06-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Revenue Attribution Plan v1

## Purpose

This plan defines PR12:
the contribution / revenue-attribution foundation for Helm on top of the already-landed organization / billing foundation.

PR11 made Helm commercially operable as an organization-based product.
The next missing layer is attribution truth:

- where revenue came from
- who should be credited
- what split rule applies
- what is payable later

This plan adds that accounting / attribution layer without widening Helm into a payout platform, marketplace, or finance console.

## Current foundation already present

Current main already has:

- `Workspace` as the v1 organization boundary
- `Membership` with fixed roles and membership status
- `BillingAccount`
- `TrialState`
- `WorkerEntitlement`
- `UsageLedger`
- settings billing overview
- narrow payment-rail visibility

This means attribution does **not** need to invent a second tenant model, second app tree, or billing rewrite.

It should extend the existing foundation through current-main-friendly seams:

- `prisma/schema.prisma`
- `lib/billing/*`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `docs/product/*`
- `docs/reviews/*`

## Why attribution is the next missing layer

Current billing truth can already explain:

- organization base fee
- active seats
- current worker entitlement posture
- lifecycle / renew / restore state

But it still cannot answer, in a structured way:

- which revenue line belongs to platform vs future worker publisher vs referral vs custom delivery
- what split rule should apply
- what amount becomes payable later
- what remains pending / approved / paid / reversed

That is the exact gap PR12 fills.

## Proposed objects

PR12 adds the narrowest object model needed for attribution truth:

### WorkerPublisherProfile

Internal beneficiary profile for worker-linked revenue attribution.

Used to answer:

- which worker revenue should credit which publisher profile
- whether that profile is active or only reserved for later payout

This is **not** a worker marketplace profile.

### SalesReferral

Organization-scoped referral record used to explain:

- which sales referral introduced or influenced the revenue
- who should be credited on that referral path

This is **not** a sales portal.

### CustomEngagement

Organization-scoped record for custom implementation / maintenance revenue.

Used to explain:

- what custom line exists
- whether it is implementation vs maintenance
- who should be credited later

This is **not** a services ERP module.

### RevenueRule

The split rule layer.

It must support:

- one-time split
- recurring split
- fixed percent
- fixed amount
- reversal on refund / cancel

This is the rule object that answers “what split applies”.

### RevenueAttributionLedger

The internal revenue-attribution record.

It answers:

- where the revenue came from
- which rule applied
- who was credited
- what amount was attributed
- whether the line is pending / approved / paid / reversed

### PayoutLedger

The internal payable-later ledger.

It answers:

- what amount is potentially payable later
- to whom
- under what status

This is **not** a payout rail.

## Phase plan

### Phase 0

Land this plan doc and freeze the scope.

### Phase 1

Add the schema and domain layer for:

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`

### Phase 2

Add attribution logic for:

- organization base fee
- additional active seats
- add-on worker revenue
- custom implementation revenue
- custom maintenance revenue
- sales referral revenue

### Phase 3

Add the minimum internal-readable visibility in settings / billing:

- revenue source type
- attributed beneficiary
- payable later amount
- pending / approved / paid / reversed status

Keep it internal-only and product-safe.

### Phase 4

Freeze the attribution baseline and acceptance packaging:

- `HELM_REVENUE_ATTRIBUTION_BASELINE_V1.md`
- `HELM_REVENUE_ATTRIBUTION_ACCEPTANCE_REPORT_V1.md`
- minimal docs index updates

## Preserved boundaries

PR12 must preserve:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route/query rewrite
- no worker marketplace
- no sales portal
- no payout rails
- no payment checkout expansion
- no invoice / tax / dunning system
- no send authority
- no workflow control
- no broader governance / admin platform

Settings may become more truthful about internal attribution posture, but it must still remain:

- a product billing overview
- an internal operator-readable surface
- not a finance console

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

## Intentionally deferred

Still deferred by design:

- payout rails
- payout trigger actions
- partner settlement systems
- worker marketplace
- partner portal
- invoices
- taxes
- retry / dunning
- full finance console
- full RBAC builder
- multi-workspace
- token / storage / retrieval customer-visible billing

## Success standard

PR12 passes only if:

- revenue can be attributed across platform / worker / custom / sales lines
- payable-later amounts are recorded
- internal visibility is truthful
- no payout rail is implied
- docs / baseline / acceptance stay honest about current-main scope
