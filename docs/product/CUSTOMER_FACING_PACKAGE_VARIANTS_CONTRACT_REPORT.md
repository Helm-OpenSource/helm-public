---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Package Variants Contract Report

## 当前状态

当前已经有 package detail、customer-facing offer / external proposal detail、reinforcement / sendability detail 三层模板，但“不同客户语境、不同推进阶段的 package variant”还没有被单独收成 detail contract。

## 本轮目标

把 customer-facing package variants 收成一版可复用 detail contract，明确：

- 当前推荐哪个 variant
- 当前 variant 属于哪种 intent / stage / audience
- 当前是否 customer-visible、review-before-send、internal-only 或 blocked
- 哪些 boundary、prerequisite、dependency 和 non-commitment 必须前置

## 当前合同

当前 contract 已固定以下核心语义：

- `packageVariantJudgement`
- `packageVariantJudgementReason`
- `packageVariantActionSummary`
- `packageVariantDecisionRequest`
- `packageVariantBoundarySummary`
- `packageVariantEvidenceSummary`
- `packageVariantWorkerSummary`
- `packageVariantNextAction`
- `packageVariantRiskSignal`
- `packageVariantAudienceMode`
- `packageVariantIntent`
- `packageVariantStage`
- `packageVariantSendabilityMode`

当前 variant 最小模式已固定为：

- `exploratory-discussion`
- `pilot-expansion`
- `customer-visible-light`
- `customer-visible-structured`
- `internal-prep-only`
- `review-before-send`
- `boundary-only`
- `dependency-blocked`
- `prerequisite-blocked`

## 放置规则

- 首屏必须显示：
  - judgement
  - judgement reason
  - why it matters
  - action summary
  - decision request
  - boundary summary
  - worker summary
- secondary summary 承载：
  - `audience mode`
  - `intent`
  - `stage`
  - `sendability`
  - customer-visible cue / internal-only cue / non-commitment cue
- `EvidenceDrawer` 默认折叠，承载：
  - `replay`
  - `audit`
  - `memory`
  - `worker_output`
  - `boundary_trace`
  - `sendability_trace`
  - `variant_trace`
  - `historical_changes`
- internal-only 内容仍必须停留在 boundary / evidence 层，不能直接抬成 customer-facing wording

## 边界

- 这是第一轮 package variants detail contract，不是完整 package engine
- 当前仍建立在 existing opportunity commercial context 上
- recommendation、discussion-only 和 boundary-only wording 仍不等于 commitment
- review-before-send / not-ready-for-customer 仍优先于任何想要直接 customer-visible 的冲动
