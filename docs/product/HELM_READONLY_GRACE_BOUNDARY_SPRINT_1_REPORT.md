---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Read-only / Grace Boundary Sprint 1 Report

## Purpose

This sprint refines the runtime boundary for `grace`, `read_only`, and `canceled` without turning Helm into a crippled feature-gated product.

Its job is to make the current lifecycle truth:

- narrower
- more honest
- easier to explain
- easier to validate

while keeping Trial / Paid fully open for the current core product.

## Scope completed

This sprint landed only these things:

1. an explicit operation matrix for `trialing / active / grace / read_only / canceled`
2. a shared lifecycle boundary helper for allowed vs paused operations
3. operation-specific runtime guard messages for blocked high-cost processing
4. settings billing overview lifecycle summary refinement
5. docs / self-check / boundary guard / test alignment

## 1. read_only / grace 的 operation matrix 是否已经清楚

Yes.

The matrix is now frozen in:

- `docs/reviews/HELM_READONLY_GRACE_BOUNDARY_PLAN_V1.md`

It explicitly covers:

- sign in
- organization switch
- dashboard / approvals / memory / diagnostics viewing
- meeting viewing
- meeting export
- memory export
- connector status read
- CRM preview recomputation
- CRM run
- import preview
- import run
- import warmup rerun
- recommendations generation
- briefing generation
- meeting action generation
- meeting memory processing
- conversation capture start / stop
- connector sync
- settings refresh / billing refresh

There is no longer a vague “depends” zone for these lifecycle states.

## 2. CRM preview / import preview / export / refresh 边界是否已经清楚

Yes.

Current truth is now explicit:

- `CRM preview`
  - means a new CRM import preview recomputation against the source
  - is blocked in `grace / read_only / canceled`
- `import preview`
  - means a local CSV draft preview
  - remains allowed in `grace / read_only / canceled`
- export
  - remains allowed
- refresh
  - remains allowed when it is reading lifecycle or billing status
  - does not reopen new high-cost processing

This keeps the wording aligned with what the runtime actually does.

## 3. 当前边界是否已经更 narrow、更 honest

Yes.

The refinement narrows the boundary in two ways:

1. it blocks only specific new high-cost processing operations instead of drifting into broad feature gating
2. it keeps viewing, export, status read, and restore-oriented settings actions open where truthful

It also makes the CRM preview wording more honest by separating:

- provider-side recomputation
- local CSV draft preview

## 4. 当前实现是否仍保持 Trial / Paid 全功能原则

Yes.

`trialing` and `active` still keep the full current core product open.

This sprint does not change:

- dashboard
- meetings
- approvals
- memory
- diagnostics
- payment rail truth
- worker entitlement truth

It only tightens the lifecycle boundary for `grace / read_only / canceled`.

## 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

Yes.

This sprint only guards the runtime boundary around high-cost processing.

It does not widen:

- recommendation semantics
- commitment semantics
- review posture
- send authority
- workflow control

So the existing A-minus posture for recommendation / commitment remains stable.

## 6. 哪些地方刻意未做，为什么

Intentionally not done:

1. broader feature gating
   - would make Helm read like a crippled lifecycle product instead of a narrow commercial boundary
2. finance console behavior
   - not needed for lifecycle boundary truth
3. payment-provider-driven lifecycle replacement
   - Helm lifecycle truth still stays product-owned
4. CRM preview redesign
   - this sprint only clarifies the runtime boundary and wording
5. deeper operator tooling
   - can come later if commercial usage shows real need

## 7. 下一阶段最该做的 5 件事是什么

1. Add a narrow lifecycle event timeline in settings so operators can see why a workspace is in `grace` or `read_only` without reading raw provider state.
2. Polish China renew / restore messaging so `grace / read_only` recovery paths stay as clear as the new boundary wording.
3. Tighten add-on worker commercial wiring so premium worker usage and entitlement posture stay as readable as the lifecycle boundary.
4. Add a small operator runbook for lifecycle support cases, especially around restore and manual refresh.
5. Recheck whether any remaining preview or warmup surface still carries ambiguous wording once real commercial demos start running more often.

## Validation

Validated with:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

Local note:

- `DATABASE_URL='file:./prisma/dev.db'` is used only as a local validation step
- it is not a product behavior change
