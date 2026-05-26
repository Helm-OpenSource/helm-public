---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Commitment Reinforcement Variants Contract Report

## 当前状态

当前已经有 reinforcement detail 与 sendability detail，但“不同强化强度、不同 customer-visible 程度、不同 fallback 层级”的 variants 还没有被单独收成 detail contract。

## 本轮目标

把 commitment reinforcement variants 收成一版可复用 detail contract，明确：

- 当前强化停在哪一层
- 当前为什么仍不能越过 commitment boundary
- 当前是否必须 review-before-send、risk-reduction-required、non-commitment-fallback 或 blocked
- 哪些 strengthening cue 可以 customer-visible
- 哪些 strengthening cue 只能 internal-only

## 当前合同

当前 contract 已固定以下核心语义：

- `reinforcementVariantJudgement`
- `reinforcementVariantJudgementReason`
- `reinforcementVariantActionSummary`
- `reinforcementVariantDecisionRequest`
- `reinforcementVariantBoundarySummary`
- `reinforcementVariantEvidenceSummary`
- `reinforcementVariantWorkerSummary`
- `reinforcementVariantNextAction`
- `reinforcementVariantRiskSignal`
- `reinforcementVariantStrengthMode`
- `reinforcementVariantIntent`
- `reinforcementVariantAudienceMode`
- `reinforcementVariantSendabilityMode`

当前 reinforcement variant 最小模式已固定为：

- `recommendation-only`
- `internal-strengthening`
- `customer-visible-light`
- `customer-visible-structured`
- `review-before-send`
- `risk-reduction-required`
- `boundary-only`
- `non-commitment-fallback`
- `blocked-strengthening`

## 放置规则

- 首屏必须显示：
  - judgement
  - why it matters
  - action summary
  - decision request
  - boundary summary
  - worker summary
- secondary summary 承载：
  - `strength mode`
  - `intent`
  - `audience mode`
  - `sendability mode`
  - customer-visible cue / internal-only cue / fallback cue
- `EvidenceDrawer` 默认折叠，承载：
  - `replay`
  - `audit`
  - `memory`
  - `worker_output`
  - `boundary_trace`
  - `sendability_trace`
  - `reinforcement_trace`
  - `historical_changes`

## 边界

- recommendation-only、discussion-safe 和 non-commitment fallback wording 仍不等于 commitment
- review-before-send、risk-reduction-required、blocked-strengthening 仍优先于任何更强 customer-visible wording
- 这是第一轮 reinforcement variants detail contract，不是完整 contract engine 或 strengthening orchestration 平台
