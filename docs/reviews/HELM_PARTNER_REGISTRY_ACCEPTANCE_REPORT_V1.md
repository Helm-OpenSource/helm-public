---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Partner Registry Acceptance Report v1

## Scope

This report records acceptance for PR13:
the contributor / partner registry and attribution-view layer on top of the already-landed billing foundation and revenue-attribution foundation.

It was evaluated as:

- an internal registry PR
- an internal attribution-readability PR

It was **not** evaluated as:

- a payout rail PR
- a worker marketplace PR
- a partner portal PR
- a finance console PR

## Phases completed

### Phase 0

Completed:

- confirmed PR11 billing foundation is already present in current main
- confirmed PR12 revenue-attribution foundation is already present in current main
- landed `HELM_PARTNER_REGISTRY_PLAN_V1.md`

### Phase 1

Completed:

- added internal create behavior for `WorkerPublisherProfile`
- added internal create behavior for `SalesReferral`
- added internal create behavior for `CustomEngagement`
- added basic status updates for all three registry objects
- added internal list / filter visibility in settings / billing

### Phase 2

Completed:

- extended internal billing visibility for beneficiary-level views
- added source breakdown readability
- exposed payable-later summary by status
- exposed rule truth:
  - why the amount is attributable
  - which rule applied
  - one-time vs recurring
  - reversal posture

### Phase 3

Completed:

- role-gated registry and attribution views to:
  - `OWNER`
  - `BILLING_ADMIN`
  - `ADMIN`
- kept non-admin members out of internal registry / attribution views
- kept UI wording explicit that this is not payout execution, not a partner portal, and not a marketplace

### Phase 4

Completed:

- added `HELM_PARTNER_REGISTRY_BASELINE_V1.md`
- added this acceptance report
- updated docs discoverability
- added tiny truthfulness checks for the new registry layer

## What landed

The following are now real current-main internal operating layers:

- worker publisher registry
- sales referral registry
- custom engagement registry
- beneficiary attribution view
- payout-later status visibility
- admin-readable role gating for registry / attribution

The system can now show, inside Helm:

- where the contribution line sits
- who is credited
- which source type produced the revenue
- what rule shape applies
- what is pending / approved / paid / reversed
- what amount is only payable later

## What remained deferred

Still deferred by design:

- payout rails
- bank / wallet disbursement
- payout trigger buttons
- worker marketplace
- public partner portal
- sales portal
- partner self-serve onboarding
- invoice / tax / retry / dunning systems
- full finance console
- full RBAC builder
- multi-workspace

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no route-owner rewrite
- no query rewrite
- no payout execution
- no worker marketplace
- no broader governance / admin platform
- no send authority
- no workflow control
- no overclaim of payout readiness or partner self-serve readiness

## Validation results

Validated on current main plus PR13 changes:

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run self-check` — passed
- `npm run check:boundaries` — passed
- `npm run build` — passed
- `npm run test` — passed

## Acceptance outcome

`go`

Reasons:

- contributor / partner registry is now operationally usable
- attribution and payable-later views are now readable by the right internal roles
- the registry layer stayed narrow and truthful
- no payout rails, portal, marketplace, or unrelated platform scope was mixed in

## Readiness for a future payout or partner portal PR

`conditional-go`

Current main is now ready for a later payout- or portal-oriented PR because:

- beneficiary registry objects exist
- attribution lines exist
- payable-later ledger exists
- admin-readable registry / attribution views exist

But a future PR must still add, separately and honestly:

- payout execution
- beneficiary onboarding
- settlement review / approval flows
- any external portal surface

So PR13 makes the registry layer operationally usable, while still stopping short of payout or portal execution.
