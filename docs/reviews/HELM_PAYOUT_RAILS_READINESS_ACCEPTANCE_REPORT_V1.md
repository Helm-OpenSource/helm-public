---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Payout Rails Readiness Acceptance Report v1

## Scope

This report closes PR18:
Payout Rails Readiness Gate.

The goal was to answer one narrow question:

- when is it worth connecting real payout rails?

This PR did not implement payout execution.

## Phases completed

1. plan frozen
2. billing-layer readiness helper landed
3. internal settings / billing readiness view landed
4. baseline, acceptance, discoverability, and guard packaging landed

## What landed

Current main now has:

- a payout-rails readiness gate
- an internal-only go/no-go view in settings / billing
- derived readiness statuses:
  - `NOT_READY`
  - `CONDITIONAL_GO`
  - `READY_FOR_NARROW_PILOT`
- blocker visibility for:
  - missing active payout profiles
  - missing settlement batch history
  - missing exported / closed settlement evidence
  - current-batch missing payout profiles
- watchpoint visibility for:
  - missing manual completion evidence
  - missing invited / active participant evidence
  - missing reversal evidence
  - paid lines that still lack exported evidence and should be audited before any rail discussion

This is an internal-only go/no-go view.
It does not expose payout execution, a public portal, or marketplace readiness.

## What remained deferred

PR18 intentionally did not add:

- payout rails
- bank / wallet transfer
- invoice / tax / retry / dunning
- public portal
- marketplace
- public finance console

## Preserved boundaries

Current main still preserves:

- payout remains off-platform/manual
- no payout execution
- no public portal
- no marketplace
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

## Validation results

The PR18 closeout validation is expected to stay green on:

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

Current main is now able to answer whether a future narrow payout-rail PR is justified.

That future PR should only start after this gate shows enough operational proof.
Even then, the next step should still be a narrow pilot design, not a broad payout platform build.
