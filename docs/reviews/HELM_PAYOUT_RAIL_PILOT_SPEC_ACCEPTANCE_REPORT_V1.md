---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Payout Rail Pilot Spec Acceptance Report v1

## Goal

PR21 was meant to freeze one narrow next-layer answer:

- once Helm can honestly say `READY_FOR_NARROW_PILOT`, what should the first payout-rail pilot look like before any real payout execution work starts?

This PR was intentionally docs/guard only.

## What landed

### 1. Plan doc

PR21 now has a dedicated rollout plan:

- [HELM_PAYOUT_RAIL_PILOT_SPEC_PLAN_V1.md](HELM_PAYOUT_RAIL_PILOT_SPEC_PLAN_V1.md)

### 2. Pilot spec

Current main now has a frozen payout-rail pilot spec:

- [HELM_PAYOUT_RAIL_PILOT_SPEC_V1.md](../product/HELM_PAYOUT_RAIL_PILOT_SPEC_V1.md)

That spec now fixes:

- live pilot entry criteria
- one-country / one-currency / one-beneficiary-class scope
- manual controls that must remain in place
- pilot success criteria
- rollback / no-go triggers

### 3. Discoverability and guards

Current main also now keeps the pilot-spec truth visible through:

- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## What remained deferred

PR21 still does **not** implement:

- payout rails
- payout execution
- bank / wallet disbursement
- public portal settlement controls
- marketplace behavior
- finance-console expansion

## Preserved boundaries

Current main still preserves all of the following:

- payout remains off-platform/manual
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

PR21 stayed green on:

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

PR21 does **not** say Helm should start payout execution now.

It says Helm now has a narrow pilot spec that keeps the first payout-rail attempt honest:

- only after live `READY_FOR_NARROW_PILOT`
- only after repeated manual settlement evidence
- only with one country, one currency, one beneficiary class, and one payout method label
- only while manual settlement remains the fallback source of truth

## Acceptance summary

PR21 is complete.
The payout rail pilot spec now exists.
It keeps future payout work narrow, manual-first, and reversible without overclaiming payout execution or marketplace readiness.
