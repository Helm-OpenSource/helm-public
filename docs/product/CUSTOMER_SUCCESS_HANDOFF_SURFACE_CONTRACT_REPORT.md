---
status: archived
owner: helm-core
created: 2026-03-28
review_after: 2026-09-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer Success Handoff Surface Contract Report

## 目标

把 `customer success` 从 `company detail` 的隐式 proxy 提升为独立的 judgement-first 接手面。

## 已定义的 canonical 交互语义

- `customerSuccessHandoffJudgement`
- `customerSuccessHandoffReason`
- `customerSuccessHandoffSummary`
- `customerSuccessHandoffBoundary`
- `customerSuccessHandoffWorkerSummary`
- `customerSuccessHandoffEvidenceSummary`
- `customerSuccessHandoffDecisionRequest`
- `customerSuccessHandoffNextAction`
- `customerSuccessHandoffRiskSignal`
- `customerSuccessHandoffAudienceMode`
- `customerSuccessHandoffOwnership`
- `customerSuccessHandoffStage`

## 当前最小 stage

- `success-follow-through`
- `activation-follow-through`
- `review-follow-through`
- `expansion-review`
- `expansion-ready-but-blocked`
- `issue-follow-through`
- `escalation-follow-through`
- `internal-prep-only`
- `review-before-send`
- `blocked-by-boundary`

## 放置规则

- 首屏：
  - 当前为什么由 customer success 接手
  - 当前 stage
  - 当前 boundary / sendability / non-commitment
  - 当前 next action / decision request
- Secondary summary：
  - ownership
  - audience mode
  - fallback
  - review pressure
- Evidence drawer：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - handoff trace
  - success trace
  - historical changes

## 边界

- `customer success handoff surface` 当前是 dedicated detail surface，不是完整 customer success platform
- `company detail` 现在回到 account context，不再承担完整 success proxy
- recommendation、review、boundary、non-commitment 仍不等于 commitment
