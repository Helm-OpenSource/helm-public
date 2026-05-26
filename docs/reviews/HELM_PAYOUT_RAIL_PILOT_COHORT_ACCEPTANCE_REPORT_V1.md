---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Payout Rail Pilot Cohort Acceptance Report v1

## Goal

PR22 was meant to land one narrow operator layer on top of the readiness gate and pilot spec:

- can current main now select one narrow payout-rail pilot cohort, explain why it qualifies, and rehearse one off-platform dry run without implying payout execution?

## What landed

### 1. Plan doc

PR22 now has a dedicated rollout plan:

- [HELM_PAYOUT_RAIL_PILOT_COHORT_PLAN_V1.md](HELM_PAYOUT_RAIL_PILOT_COHORT_PLAN_V1.md)

### 2. Frozen baseline

Current main now has a frozen cohort/operator baseline:

- [HELM_PAYOUT_RAIL_PILOT_COHORT_BASELINE_V1.md](../product/HELM_PAYOUT_RAIL_PILOT_COHORT_BASELINE_V1.md)

That baseline now fixes:

- the pilot cohort gate
- the operator readiness pack
- the dry-run export contract
- no-go / rollback triggers
- manual settlement as fallback source of truth

### 3. Runtime helper + internal settings visibility

Current main now includes:

- one payout rail pilot cohort helper
- one payout rail pilot cohort test
- one internal settings/billing operator pack card

That layer now shows:

- eligible cohort count
- ready cohort count
- recommended beneficiary class / payout method / currency
- operator checklist
- next operator moves
- dry-run export contract
- no-go / rollback triggers

### 4. Discoverability and guards

Current main also now keeps the PR22 truth visible through:

- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## What remained deferred

PR22 still does **not** implement:

- payout rails
- payout execution
- bank / wallet disbursement
- public portal settlement
- marketplace behavior
- finance-console expansion

## Preserved boundaries

Current main still preserves all of the following:

- no payout rails
- no payout execution
- no public portal
- no marketplace
- no full finance console
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

## Validation results

PR22 stayed green on:

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## Readiness for a future payout-rail PR

PR22 does **not** say Helm should start payout execution now.

It says current main now has one narrow operator pack that can:

- decide whether operators should keep manual posture
- decide whether one beneficiary class must still be chosen
- decide whether one cohort is already ready for an off-platform dry run
- keep manual settlement remains the fallback source of truth

## Acceptance summary

PR22 is complete.
The payout rail pilot cohort gate now exists.
The operator readiness pack now exists.
The dry-run export contract and rollback posture now exist.
Current main can now move from abstract pilot spec into one narrow operator dry-run decision, without overclaiming payout execution or marketplace readiness.
