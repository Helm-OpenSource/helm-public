---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Baseline 1-5 Alignment Report

## 本轮对齐范围

- `README.md`
- `docs/README.md`
- foundation docs
- Sprint 1-5 reports
- baseline freeze docs
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- Sprint 2 / 3 / 4 / 5 eval scripts

## 当前统一 truth

- foundation 仍是：
  - object graph
  - layered memory
  - artifact-first worker
  - action-level approval / audit
- runtime 仍是：
  - review-first
  - shadow-first
  - draft-first
  - manual execution first
- boundary 仍是：
  - recommendation 不等于 commitment
  - approved 不等于 executed
  - approved 不等于 sent / booked / committed / official writeback
  - execution proof 不等于 external outcome truth

## 这轮新增对齐点

1. docs index 已能把 Sprint 1-5 freeze / runtime / eval 入口放在一起。
2. self-check 已能同时检查：
   - Baseline Freeze 1-4 历史入口
   - Sprint 5 runtime truth
   - Baseline Freeze 1-5 当前入口
3. boundary guard 已能同时检查：
   - foundation planned-only boundary
   - Sprint 2 / 3 / 4 / 5 runtime boundary
   - Baseline Freeze 1-5 的总边界

## 当前仍必须保留的表达

- send authority 仍然没有打开
- auto booking 仍然没有打开
- official CRM writeback 仍然没有打开
- default team mode 仍然没有打开
- 当前版本仍不是完整 operating platform

## 结论

Baseline 1-5 的 README / docs / guards / tests / eval 入口已经对齐。  
当前后续 Sprint 6 之前，不应该再出现“一处写 Sprint 5 已执行、一处仍把它写成 planned”这类 drift。
