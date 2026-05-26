---
status: archived
owner: helm-core
created: 2026-03-28
review_after: 2026-09-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer Success Handoff Model Report

## 最小 handoff

- `review request -> customer success`
- `company detail -> customer success`
- `success check -> customer success`
- `expansion review -> customer success`
- `customer success -> package`
- `customer success -> proposal`
- `customer success -> customer-facing offer`
- `customer success -> external proposal`
- `customer success -> reinforcement`
- `customer success -> founder / sales / delivery`

## 每条 handoff 保留字段

- `handoffSource`
- `handoffTarget`
- `handoffReason`
- `handoffBoundary`
- `handoffPrerequisite`
- `handoffDependency`
- `handoffRisk`
- `handoffDecisionRequest`
- `handoffNextAction`
- `handoffWorkerSummary`
- `handoffEvidenceSummary`
- `handoffVisibilityMode`

## 当前结论

- customer success handoff 已经不再靠隐式跳转
- `review request -> customer success` 现在是 dedicated handoff，不再以 `company detail` 补位
- `company detail` 当前只承担 account context refresh，不再等于 customer success judgement

## 边界

- 当前不是 workflow engine
- 当前不是完整 customer success platform
- 当前 handoff 仍然是第一轮局部落地，不是全站详情页完成统一
