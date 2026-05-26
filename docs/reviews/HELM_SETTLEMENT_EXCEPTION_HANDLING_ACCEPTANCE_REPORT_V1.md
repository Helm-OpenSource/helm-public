---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Settlement Exception Handling Acceptance Report v1

## Scope

This report closes PR20:
Settlement Reversal / Exception Handling Polish.

The goal was to make manual settlement exceptions and reversals operationally readable without adding payout rails.

## Phases completed

1. plan frozen
2. settlement transition guard polish landed
3. settlement exceptions helper landed
4. internal settings / billing exception visibility landed
5. baseline, acceptance, discoverability, and guard packaging landed

## What landed

Current main now has:

- tighter paid-transition guards for settlement lines that now require exported posture before paid
- a settlement exceptions summary helper
- internal visibility for:
  - missing payout profile posture
  - inactive payout profile posture
  - suspended / archived participant posture
  - exported-but-not-settled lines
  - paid-without-export anomalies
  - recent reversals
- next operator move guidance inside settings / billing

The internal settings view now explains:

- which lines are blocked
- which lines still need manual completion
- which reversals already happened
- what the operator should do next

## What remained deferred

PR20 intentionally did not add:

- payout rails
- payout execution
- bank / wallet transfer
- public portal settlement controls
- marketplace
- full finance console

## Preserved boundaries

Current main still preserves:

- payout remains off-platform/manual
- no payout rails
- no payout execution
- no public portal
- no marketplace
- no send authority
- no workflow control
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade

## Validation results

The PR20 closeout validation is expected to stay green on:

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## Outcome

Current main is now able to truthfully say:

- settlement reversals remain explicit and manual
- exported / blocked / inconsistent settlement posture is visible before any payout-rail work starts
- invalid paid transitions are prevented

That still does **not** mean payout execution exists.
