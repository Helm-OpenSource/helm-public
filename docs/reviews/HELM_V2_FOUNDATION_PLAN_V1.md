---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2 Foundation Plan v1

## Purpose

This document freezes the first Helm v2 foundation sprint on top of current main.

The goal is **not** to jump straight into more agents.
The goal is to make four things explicit and implementable first:

1. layered memory
2. object-centered runtime
3. artifact-first workers
4. action-tier approval + audit

## Current main foundation already present

Current main already has:

- workspace-first organization boundary
- judgement-first product surfaces
- meeting-first wedge
- memory page and memory writeback
- approval boundary and audit trail
- operating-system layer docs and shared contracts
- controlled trial / billing / contribution / settlement foundations

That means Helm already has enough product and governance truth to start a v2 foundation sprint without reopening route ownership, shell thinning, or platform sprawl.

## Why Helm v2 foundation is the next missing layer

Current main has:

- operating-system intent
- memory / approval / audit seams
- controlled action preparation
- program / contribution / settlement seams

But it still does **not** yet have one explicit v2 contract layer that says:

- how layered memory should be represented
- how event flow should drive workers
- how artifact bundles should replace hidden chat state
- how approval tiers should map to concrete actions
- how shadow vs official state should stay physically separate

Without that layer, the repo risks adding more AI surfaces before the runtime model is explicit enough.

## Scope of this sprint

This sprint should land:

1. Helm v2 PRD skeleton
2. event flow diagram + API contract package
3. data model design package
4. 90-day engineering plan
5. first code foundation slice:
   - v2 contract types
   - layered memory helper
   - artifact-first worker registry
   - approval matrix
   - event flow catalog

## Preserved boundaries

This sprint must preserve all of the following:

- no send authority
- no workflow control
- no payment or payout expansion
- no marketplace
- no second app tree
- no route/query rewrite
- no shell thinning
- no CRM replacement claim
- no generalized autonomous agent-team default

## Explicitly deferred

This sprint does **not** yet implement:

- new runtime routes
- new persisted v2 tables
- live event bus
- automatic CRM official writes
- automatic external send
- automatic quote / contract / commitment execution
- full agent team runtime
- long-running cross-org autonomy

## Rollout phases

### Phase 0

Audit current seams and freeze the plan.

### Phase 1

Create the doc package:

- PRD
- event flow + API contracts
- data model design
- engineering plan

### Phase 2

Land the first code contract layer:

- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/layered-memory.ts`
- `lib/helm-v2/artifact-workers.ts`
- `lib/helm-v2/approval-matrix.ts`
- `lib/helm-v2/event-flow.ts`

### Phase 3

Update discoverability and truthfulness guards:

- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

### Phase 4

Run full validation and freeze the sprint report.

## Validation contract

This sprint should run:

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## Outcome target

After this sprint, current main should be able to say:

- Helm v2 now has a frozen PRD skeleton
- Helm v2 now has event/API/data model design docs
- Helm v2 now has a first explicit runtime-contract layer in code
- and that layer is still narrow, truthful, and controlled
