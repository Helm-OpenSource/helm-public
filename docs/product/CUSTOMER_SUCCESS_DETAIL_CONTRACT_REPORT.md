---
status: archived
owner: helm-core
created: 2026-03-28
review_after: 2026-09-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer Success Detail Contract Report

## 目标

定义独立的 `customer success detail reporting contract`，避免每页临时拼 success / expansion / review follow-through 结构。

## 已定义的 detail 语义

- `customerSuccessDetailJudgement`
- `customerSuccessDetailReason`
- `customerSuccessDetailActionSummary`
- `customerSuccessDetailDecisionRequest`
- `customerSuccessDetailBoundarySummary`
- `customerSuccessDetailEvidenceSummary`
- `customerSuccessDetailWorkerSummary`
- `customerSuccessDetailNextAction`
- `customerSuccessDetailRiskSignal`
- `customerSuccessDetailAudienceMode`
- `customerSuccessDetailStage`
- `customerSuccessDetailSendabilityMode`
- `customerSuccessDetailFallbackMode`

## 页面分层

- 首屏：
  - judgement
  - judgement reason
  - why it matters
  - action summary
  - decision request
  - next action
- Secondary summary：
  - stage
  - ownership
  - audience
  - sendability
  - fallback
  - review pressure
- Evidence drawer：
  - 所有 replay / audit / memory / worker / boundary / handoff / success trace

## 当前结论

- customer success detail contract 已清楚
- 当前不再需要每页手写 success / expansion / boundary / next-step 结构
- 当前 contract 默认继续保留 `review-before-send`、`boundary-only`、`internal-only`、`non-commitment fallback`
