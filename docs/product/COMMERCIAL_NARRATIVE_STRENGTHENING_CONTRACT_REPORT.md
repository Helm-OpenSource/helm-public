---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Commercial Narrative Strengthening Contract Report

## 当前状态

Helm 已经有 reinforcement detail、sendability detail 和 reinforcement variants detail，但“商业叙事应强化到哪一层”此前仍容易散落在 review hint、fallback note 和 sendability cue 中。

本轮把 `commercial narrative strengthening` 单独收成一份 judgement-first contract，用来承接：

- strengthening level
- audience
- sendability
- fallback
- boundary
- evidence

## 当前版本 contract

当前最小核心语义已经固定为：

- `strengtheningJudgement`
- `strengtheningJudgementReason`
- `strengtheningActionSummary`
- `strengtheningDecisionRequest`
- `strengtheningBoundarySummary`
- `strengtheningEvidenceSummary`
- `strengtheningWorkerSummary`
- `strengtheningNextAction`
- `strengtheningRiskSignal`
- `strengtheningLevel`
- `strengtheningIntent`
- `strengtheningAudienceMode`
- `strengtheningFallbackMode`

当前版本额外固定：

- `strengtheningSendabilityMode`
- `strengtheningEvidenceGroups`
- `strengtheningCustomerVisibleCue`
- `strengtheningInternalOnlyCue`
- `strengtheningFallbackCue`

## Strengthening 模式

当前第一轮固定以下 `strengtheningLevel`：

- `recommendation-only`
- `exploratory-strengthening`
- `pilot-strengthening`
- `customer-visible-light`
- `customer-visible-structured`
- `review-before-send`
- `risk-reduction-required`
- `boundary-only`
- `non-commitment-fallback`
- `blocked-strengthening`

当前第一轮固定以下 `fallback`：

- `no-fallback`
- `boundary-only`
- `non-commitment-fallback`
- `review-hold`
- `blocked`

这批模式已经足够覆盖当前商业叙事里“更强表达但仍不越界”的第一轮判断，但它们仍只是第一轮 detail judgement 模板，不等于完整 commercial engine、contract engine 或 legal review 平台。

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
  - strengthening level
  - intent
  - audience
  - sendability
  - fallback
  - customer-visible / internal-only / fallback cue
- `EvidenceDrawer` 默认折叠，承载：
  - `replay`
  - `audit`
  - `memory`
  - `worker_output`
  - `boundary_trace`
  - `sendability_trace`
  - `strengthening_trace`
  - `fallback_trace`
  - `historical_changes`

## 边界

当前 contract 默认强制以下边界：

- strengthening 不等于 commitment
- `exploratory-strengthening`、`discussion-only`、`boundary-only`、`review-before-send` 不能被包装成正式承诺
- `customer-visible-*` 也仍然不是自动承诺
- 一旦 strengthening 压力超过证据和边界清晰度，默认必须退回：
  - `non-commitment-fallback`
  - `boundary-only`
  - `review-hold`

## 当前结论

`commercial narrative strengthening reporting contract` 已经清楚，并已落到共享类型、共享验证和页面 contract builder。后续 strengthening detail 页可以沿这套 contract 继续扩展，而不需要重新临时拼 strengthening / fallback 结构。
