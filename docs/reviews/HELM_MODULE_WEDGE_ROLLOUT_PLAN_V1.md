---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Module Wedge Rollout Plan v1

## Purpose

This document defines the full rollout program for reusing the Meeting OS Wedge method across the current Helm module inventory.

The goal is not to turn every page into a meeting clone.
The goal is to ensure every relevant module ends in one honest state:

1. full wedge
2. thin adoption
3. support-only / non-wedge

This rollout is complete only when every audited module has one of those outcomes and the rationale is written down.

## Current proven reference method

The rollout reuses the product method frozen in the Meeting OS Wedge v2 plus the shared-agent thin-adoption baselines already landed on current main.

Reference method:

1. first-screen answers:
   - why this surface matters now
   - which objects / states it affects
   - what the most important next step is
   - what the current boundary / review posture is
   - what memory / source context supports that read
2. memory stays source-grounded and lifecycle-aware
3. formal review stays formal where appropriate
4. governance cues stay readable and conservative
5. diagnostics / readiness stays workflow-scoped where applicable
6. Ask Helm, if present, stays scoped, read-only, and source-grounded
7. thin surfaces remain visibly thinner than the richer proving-ground surfaces

## Rollout categories

### Full operating surface

A surface deserves full wedge treatment only if it is already a first-class operating entry or control point.

Examples:

- dashboard
- meetings detail
- approvals
- memory
- diagnostics

### Review surface

A surface deserves thin adoption when the user mainly needs:

- why this item matters now
- what is under review or being decided
- what the next step is
- what the current boundary posture is
- what source / memory context supports the read

These surfaces must remain thinner than Meeting OS.

### Object/context surface

These surfaces should stay object-centric.
They may adopt why-now, object-state, next-step, boundary, and source cues only where truthful.

### Support/admin surface

These surfaces should receive either:

- thin shared cue adoption
- or explicit support-only / non-wedge classification

No surface in this category should be force-fit into a fake operating wedge.

## Per-module adoption target

The detailed target state for every audited module is frozen in:

- [HELM_MODULE_WEDGE_ACCEPTANCE_MATRIX_V1.md](HELM_MODULE_WEDGE_ACCEPTANCE_MATRIX_V1.md)

High-level targets:

- primary operating surfaces: full wedge
- review / decision surfaces: thin adoption
- object / context surfaces: thin adoption unless the page is better kept support-only
- support / admin surfaces: thin adoption only where already semantically present, otherwise support-only

## Per-phase landing order

### Phase 0

- inventory
- rollout matrix
- boundary and validation contract

### Phase 1

- dashboard
- meetings detail
- approvals
- memory
- diagnostics

### Phase 2

- review-request detail
- success-check detail
- expansion-review detail
- other shared-agent review/detail variants that already sit on the same thin-adoption seam

### Phase 3

- opportunities
- companies detail
- contacts detail
- inbox
- inbox detail
- meetings list
- proposal / offer / conversation / delivery / founder / sales detail variants

### Phase 4

- search
- settings
- imports
- analytics
- reports
- capture
- remaining support/admin routes

### Phase 5

- freeze the rollout baseline
- publish the acceptance report
- update docs discoverability

## Preserved boundaries

- no send authority
- no workflow control
- no second app tree
- no platform expansion
- no shell thinning
- no connector marketplace
- no broader governance / permissions platform
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no route-owner or query-structure migration
- no overclaim of telemetry-backed readiness
- no commitment drift

## Validation contract

After each phase:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

After any real product behavior or view change:

- `npm run build`
- `npm run test`

At final closeout:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## Whole-rollout definition of done

The rollout is done only when all of the following are true:

1. every audited module has been processed
2. every audited module is now one of:
   - full wedge
   - thin adoption
   - support-only / non-wedge
3. the Meeting OS method has been reused consistently without over-normalizing
4. no boundary has been broken
5. the plan / matrix / baseline / acceptance docs are complete
6. validations are green
7. no unrelated scope was mixed into the rollout
