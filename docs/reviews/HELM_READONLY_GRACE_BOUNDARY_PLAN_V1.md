---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_READONLY_GRACE_BOUNDARY_PLAN_V1

## Purpose

Freeze a narrow, honest, runtime-ready boundary for `grace` and `read_only` without turning Helm into a crippled feature-gated product.

This sprint only refines:

- allowed vs blocked operation semantics
- runtime guard precision
- settings readability
- tests / self-check / boundary guard alignment

It does not widen product scope.

## Current truth to preserve

- lifecycle truth remains:
  - `trialing`
  - `active`
  - `grace`
  - `read_only`
  - `canceled`
- Trial and Paid both keep the full current core product
- `grace / read_only / canceled` should mainly pause new high-cost processing
- viewing, export, status read, and restore-oriented settings actions should remain open where truthful
- payment/provider state still maps into Helm lifecycle truth; it does not replace it

## Operation matrix

Legend:

- `allow`: allowed as-is
- `block`: blocked by lifecycle guard

| Operation | trialing | active | grace | read_only | canceled |
| --- | --- | --- | --- | --- | --- |
| sign in | allow | allow | allow | allow | allow |
| organization switch | allow | allow | allow | allow | allow |
| dashboard / approvals / memory / diagnostics viewing | allow | allow | allow | allow | allow |
| meeting viewing | allow | allow | allow | allow | allow |
| meeting export | allow | allow | allow | allow | allow |
| memory export | allow | allow | allow | allow | allow |
| connector status read | allow | allow | allow | allow | allow |
| CRM preview recomputation | allow | allow | block | block | block |
| CRM run | allow | allow | block | block | block |
| import preview (local CSV draft preview) | allow | allow | allow | allow | allow |
| import run | allow | allow | block | block | block |
| import warmup rerun | allow | allow | block | block | block |
| recommendations generation | allow | allow | block | block | block |
| briefing generation | allow | allow | block | block | block |
| meeting action generation | allow | allow | block | block | block |
| meeting memory processing | allow | allow | block | block | block |
| conversation capture start / stop | allow | allow | block | block | block |
| connector sync | allow | allow | block | block | block |
| settings refresh / billing refresh | allow | allow | allow | allow | allow |

## Important wording freeze

- `CRM preview` means a new CRM import preview recomputation against the source
- `import preview` means a local draft preview of uploaded CSV input
- export remains allowed in `grace / read_only / canceled`
- refresh remains allowed when it is state-reading or billing-refresh behavior, not a new high-cost processing run
- blocked operations should explain what is paused and why

## Proposed implementation phases

### Phase 1. lifecycle boundary helper

Add a narrow helper layer that can answer:

- what is still available in the current lifecycle state
- what high-cost processing is paused
- the correct scope note for CRM preview wording
- the correct runtime error message for a specific blocked operation

### Phase 2. runtime guard precision

Update these seams to pass explicit operation keys:

- `features/meetings/actions.ts`
- `features/memory/actions.ts`
- `features/connectors/actions.ts`
- `features/imports/actions.ts`
- `app/api/recommendations/next-actions/route.ts`
- `app/api/briefings/meeting/[meetingId]/route.ts`
- `app/api/memory/export/route.ts`
- `app/api/conversation-capture/start/route.ts`
- `app/api/conversation-capture/[sessionId]/stop/route.ts`
- `app/api/imports/crm/preview/route.ts`
- `app/api/imports/crm/run/route.ts`
- `app/api/imports/jobs/[jobId]/warmup/route.ts`

### Phase 3. settings / docs / self-check / guard / tests

Synchronize:

- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- billing lifecycle tests
- regression tests for allowed vs blocked operations

## Preserved boundaries

- no feature gating expansion
- no finance console
- no billing platform expansion
- no enterprise permission platform
- no workflow control
- no send authority
- no new platform abstraction

## Validation contract

Final validation must include:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## Definition of done

Done means:

- the operation matrix is explicit and stable
- runtime guard behavior matches the matrix
- settings explains the lifecycle boundary clearly
- export / refresh / preview wording is honest
- docs, guards, tests, and self-check all agree
