---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Package Stage Variants Contract Report

## 当前状态

Helm 已经有 package detail、package variants detail 和 unified detail navigation，但“同一条 package 在不同推进阶段应该停在哪一层”此前仍散落在 boundary note、review hint 和 variants cue 里。

本轮把 `package stage variants` 单独收成一份 judgement-first contract，避免页面继续临时拼 `stage / audience / sendability / boundary`。

## 当前版本 contract

当前最小核心语义已经固定为：

- `packageStageJudgement`
- `packageStageJudgementReason`
- `packageStageActionSummary`
- `packageStageDecisionRequest`
- `packageStageBoundarySummary`
- `packageStageEvidenceSummary`
- `packageStageWorkerSummary`
- `packageStageNextAction`
- `packageStageRiskSignal`
- `packageStageAudienceMode`
- `packageStageIntent`
- `packageStageMode`

当前版本额外固定：

- `packageStageSendabilityMode`
- `packageStageEvidenceGroups`
- `packageStageCustomerVisibleCue`
- `packageStageInternalOnlyCue`
- `packageStageNonCommitmentCue`

## Stage 模式

当前第一轮固定以下 `packageStageMode`：

- `exploratory`
- `exploratory-with-boundary`
- `exploratory-with-prerequisite`
- `exploratory-with-dependency`
- `pilot-ready`
- `pilot-expansion`
- `customer-visible-light`
- `customer-visible-structured`
- `review-before-send`
- `boundary-only`
- `dependency-blocked`
- `prerequisite-blocked`

这批模式已经足够承接当前 package 推进链里的“阶段变化”，但它们仍只是第一轮 detail judgement 模板，不等于完整 package engine。

## 首屏与附注层规则

当前基线：

- 首屏必须显示：
  - judgement
  - judgement reason
  - why it matters
  - action summary
  - decision request
  - boundary summary
  - worker summary
- secondary summary 用来承载：
  - `stage mode`
  - `intent`
  - `audience`
  - `sendability`
  - customer-visible / internal-only / non-commitment cue
- `EvidenceDrawer` 默认折叠，承载：
  - `replay`
  - `audit`
  - `memory`
  - `worker_output`
  - `boundary_trace`
  - `sendability_trace`
  - `stage_trace`
  - `historical_changes`

## 边界

当前 contract 默认强制以下边界：

- package stage 不等于最终承诺
- `customer-visible-*` 仍不等于 commitment
- `exploratory-*`、`boundary-only`、`dependency-blocked`、`prerequisite-blocked` 不能被包装成可安全对外承诺
- 任何可能被误解成 commitment 的 wording，都必须继续挂上：
  - `boundary`
  - `prerequisite`
  - `dependency`
  - `non-commitment`

## 当前结论

`package stage variants reporting contract` 已经清楚，并已落到共享类型、共享验证和页面 contract builder。后续 stage detail 页可以继续沿这套 contract 扩展，而不需要重新临时拼 judgement 结构。
