---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Conversation Detail Contract Report

## 当前状态

当前 `conversation` 已经不再只存在于 pack、cue、script 和 oral note 里。它现在被收成一份可复用的 detail reporting contract，用来承接：

- conversation scene
- audience mode
- sendability mode
- boundary / prerequisite / dependency / non-commitment
- next action / decision request
- worker / evidence grouping

## 当前版本基线

当前最小核心语义已经成立：

- `conversationDetailJudgement`
- `conversationDetailJudgementReason`
- `conversationDetailActionSummary`
- `conversationDetailDecisionRequest`
- `conversationDetailBoundarySummary`
- `conversationDetailEvidenceSummary`
- `conversationDetailWorkerSummary`
- `conversationDetailNextAction`
- `conversationDetailRiskSignal`
- `conversationDetailAudienceMode`
- `conversationDetailIntent`
- `conversationDetailMode`
- `conversationDetailSendabilityMode`

当前最小模式已经明确：

- `founder-meeting`
- `founder-demo`
- `sales-first-contact`
- `sales-follow-up`
- `objection-handling`
- `proposal-walkthrough`
- `boundary-clarification`
- `prerequisite-clarification`
- `dependency-clarification`
- `non-commitment-clarification`
- `internal-prep-only`
- `review-before-send`

## 放置规则

当前首屏必须优先承载：

- 当前 judgement
- judgement reason
- Helm 已推进动作
- decision request
- boundary summary

当前次级摘要继续承载：

- audience mode
- scene intent
- founder / sales / delivery cue
- current owner / due date

当前只进入 `EvidenceDrawer` 的内容：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- conversation trace
- scenario trace
- historical changes

## 当前边界

- conversation detail 当前只是一版 judgement-first detail contract
- 它不是完整 messaging platform
- 它不是完整 sales enablement / battlecard / CRM 平台
- 任何 customer-facing wording 只要可能被误解成 commitment，仍必须降级为 boundary / prerequisite / dependency / non-commitment note

## 结论

`conversation detail reporting contract` 当前已经清楚，足以支持第一轮 conversation detail 页与后续 founder / sales / delivery 沟通 detail 扩展，但仍只是第一轮可复用 detail contract，不是完整 conversation engine。
