---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Foundation Sprint 1 Report

## Goal

This sprint was meant to take the Helm v2 skeleton and turn it into a repo-ready foundation package:

- PRD
- event/API contracts
- data model design
- engineering plan
- first code contract layer

## What landed

### 1. Product package

Current main now has:

- [HELM_V2_FOUNDATION_PRD_V1.md](../product/HELM_V2_FOUNDATION_PRD_V1.md)
- [HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md](../product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md)
- [HELM_V2_DATA_MODEL_V1.md](../product/HELM_V2_DATA_MODEL_V1.md)
- [HELM_V2_ENGINEERING_PLAN_V1.md](../product/HELM_V2_ENGINEERING_PLAN_V1.md)

### 2. Rollout plan

Current main now also has:

- [HELM_V2_FOUNDATION_PLAN_V1.md](HELM_V2_FOUNDATION_PLAN_V1.md)

### 3. First code contract layer

Current main now includes:

- [contracts.ts](../../lib/helm-v2/contracts.ts)
- [layered-memory.ts](../../lib/helm-v2/layered-memory.ts)
- [artifact-workers.ts](../../lib/helm-v2/artifact-workers.ts)
- [approval-matrix.ts](../../lib/helm-v2/approval-matrix.ts)
- [event-flow.ts](../../lib/helm-v2/event-flow.ts)
- [foundation-contracts.test.ts](../../lib/helm-v2/foundation-contracts.test.ts)

This means Helm v2 now has explicit code-level contracts for:

- layered memory
- artifact-first workers
- action-tier approval
- event flow + planned API contracts

## What remained deferred

This sprint still does **not** implement:

- live event bus
- persisted v2 runtime tables
- runtime worker orchestration
- automatic CRM official writes
- external send
- team-mode runtime

## Preserved boundaries

Current main still preserves:

- no send authority
- no workflow control
- no marketplace
- no autonomous commitment behavior
- no route-owner rewrite
- no shell thinning

## Validation

This sprint stayed green on:

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

Helm v2 is no longer only a direction memo.

After this sprint, current main has:

- a frozen v2 product skeleton
- a frozen v2 event/API/data model package
- a first real code contract layer

That is enough to start Phase 2 runtime implementation without improvising the four core rules again.
