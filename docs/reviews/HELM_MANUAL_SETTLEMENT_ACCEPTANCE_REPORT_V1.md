---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Manual Settlement Acceptance Report v1

## Scope

This report records acceptance for PR14:
the manual settlement workflow and payout-profile foundation on top of the already-landed billing, revenue-attribution, and partner-registry foundations.

It was evaluated as:

- a narrow internal settlement-operations PR
- an internal payout-profile-readability PR

It was **not** evaluated as:

- a payout rail PR
- a public portal PR
- a marketplace PR
- a finance console PR

## Phases completed

### Phase 0

Completed:

- confirmed PR11 billing foundation is already present in current main
- confirmed PR12 revenue-attribution foundation is already present in current main
- confirmed PR13 contributor / partner registry is already present in current main
- landed `HELM_MANUAL_SETTLEMENT_PLAN_V1.md`

### Phase 1

Completed:

- added `BeneficiaryPayoutProfile`
- supported worker publisher beneficiaries
- supported sales referral beneficiaries
- supported custom engagement beneficiaries
- added internal create / status visibility for payout profiles

### Phase 2

Completed:

- added `SettlementBatch`
- added `SettlementBatchLine`
- added monthly batch creation for eligible payout-ledger lines
- added approve / export / paid / reversed / close lifecycle support
- kept reversals explicit and manual

### Phase 3

Completed:

- added internal settlement views in settings / billing
- exposed:
  - current batch
  - beneficiary totals
  - source-type totals
  - line-status posture
  - payout-profile presence / missing-profile warnings
- kept those views readable only for:
  - `OWNER`
  - `BILLING_ADMIN`
  - `ADMIN`

### Phase 4

Completed:

- added CSV/manual export for current settlement batches
- kept export limited to off-platform/manual payment support

### Phase 5

Completed:

- added `HELM_MANUAL_SETTLEMENT_BASELINE_V1.md`
- added this acceptance report
- updated docs discoverability
- added tiny truthfulness checks for manual settlement scope

## What landed

The following are now real current-main internal operating layers:

- beneficiary payout profile foundation
- settlement batch object model
- settlement batch lifecycle
- internal settlement visibility in settings / billing
- CSV/manual export for settlement batches

Current main can now:

- collect payout profile information before settlement reaches export posture
- group payable-later lines into a monthly batch
- review totals by beneficiary and source type
- approve a batch internally
- export a batch for off-platform/manual payment handling
- mark lines exported / paid / reversed

## What remained deferred

Still deferred by design:

- payout rails
- bank / wallet disbursement
- payout trigger automation
- public partner portal
- worker marketplace
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
- no public portal
- no marketplace
- no broader governance / admin platform
- no send authority
- no workflow control
- no overclaim of payout execution readiness

## Validation results

Validated on current main plus PR14 changes:

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run self-check` — passed
- `npm run check:boundaries` — passed
- `npm run build` — passed
- `npm run test` — passed

## Acceptance outcome

`go`

Reasons:

- beneficiary payout profiles are now real
- manual settlement batches are now real
- internal monthly settlement can now be reviewed and exported
- the workflow stayed narrow and truthful
- no payout rail, portal, marketplace, or unrelated platform scope was mixed in

## Readiness for a future payout-rail PR

`conditional-go`

Current main is now ready for a later payout-rail PR because:

- beneficiary payout profiles exist
- payable-later lines can be grouped into settlement batches
- internal settlement review exists
- CSV/manual export exists

But a future payout-oriented PR must still add, separately and honestly:

- actual payout execution
- bank / wallet transfer
- beneficiary onboarding / compliance workflows
- any external beneficiary surface

So PR14 makes settlement operationally usable while keeping payout remains off-platform/manual.
