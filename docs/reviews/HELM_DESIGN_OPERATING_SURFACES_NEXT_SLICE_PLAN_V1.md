---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Operating Surfaces Next Slice Plan V1

更新时间：2026-04-07
结论：Completed

## 目标

把 `DESIGN.md` 的 shared guidance / preference / form-assist 结构，从 PR78 的九个关键 surface 扩到三类 operating-heavy surface：

1. opportunities
2. reports
3. diagnostics

并收口：

- responsive top structure
- boundary-first wording
- assist / read-only posture
- baseline / report / README / docs / guards / pilot-readiness

## 范围

- `features/opportunities/opportunities-client.tsx`
- `features/reports/reports-client.tsx`
- `features/diagnostics/diagnostics-client.tsx`
- baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`

## 不做

- 全站 redesign
- server-side preference sync
- workflow automation UI
- execution-authority expansion

## 实施顺序

### Phase 0

- 复核 `DESIGN.md`、PR77 shared substrate、PR78 detail-heavy 顶部结构
- 状态：Completed

### Phase 1

- 重做 opportunities / reports / diagnostics 顶部结构
- 接 guidance / reminders / preferences / form-assist
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed
