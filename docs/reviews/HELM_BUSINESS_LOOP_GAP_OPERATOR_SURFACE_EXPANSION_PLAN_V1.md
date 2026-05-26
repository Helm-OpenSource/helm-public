---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_PLAN_V1

Status: Implementation Completed
Owner: Helm Core
Date: 2026-04-08

## 1. 本轮目标

PR107 只做两件事：

1. 让 `approvals` 复用共享 `businessLoopGapSummary`
2. 让 `imports` 复用共享 `businessLoopGapSummary`

## 2. 范围

### In Scope

- `features/approvals/page-loader.ts`
- `app/(workspace)/approvals/page.tsx`
- `features/approvals/approvals-client.tsx`
- `app/(workspace)/imports/page.tsx`
- `features/imports/imports-client.tsx`
- docs / index / guards / tests

### Out of Scope

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- analytics refactor
- execution-authority expansion

## 3. 验收标准

- `approvals` 首屏复用共享 `businessLoopGapSummary.primaryGap`
- `imports` 首屏复用共享 `businessLoopGapSummary.primaryGap`
- `BusinessFirstSurfaceSummary` 四类信息 contract 不变
- README / docs/README / PLANS / self-check / boundary-check / pilot:check 同步
- 完整验证链全绿
