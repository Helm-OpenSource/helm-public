---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Import Surfaces Next Slice Plan V1

更新时间：2026-04-07
状态：Completed

## 1. 目标

验证 shared design substrate 是否能在 import operator-heavy surface 上保持一致：

1. imports
2. import conflicts
3. import job detail

## 2. 范围

- `features/imports/imports-client.tsx`
- `features/imports/import-conflicts-client.tsx`
- `features/imports/import-job-detail-client.tsx`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 3. 执行步骤

### Phase 0

- 复核 `DESIGN.md`、PR77 / PR78 / PR79 的 shared guidance substrate
- 状态：Completed

### Phase 1

- 把 imports / conflicts / import result 接入 guidance / preferences / form assist
- 状态：Completed

### Phase 2

- 补 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 跑完整验证链
- 状态：Completed

## 4. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
