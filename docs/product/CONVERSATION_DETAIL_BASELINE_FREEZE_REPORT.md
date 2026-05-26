---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Conversation Detail Baseline Freeze Report

## 当前冻结范围

当前 conversation detail baseline 冻结以下核心语义：

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

## 当前已成立的 scene / mode 基线

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

## 当前基线规则

- 首屏默认先看 judgement、reason、Helm did、decision request、next action
- `audience mode / sendability / boundary / non-commitment` 默认继续可见
- replay / audit / memory / worker output / trace 默认降到 `EvidenceDrawer`
- founder / sales / delivery cue 可以改变表达方式，但不能把 discussion-safe wording 变成 commitment

## 哪些 scene 适合 customer-facing

- `founder-meeting`
- `founder-demo`
- `sales-first-contact`
- `sales-follow-up`
- `proposal-walkthrough`

前提：

- boundary 已明确
- 没有把 recommendation 误讲成 commitment
- sendability 没有停在 `internal-prep-only` 或 `review-before-send`

## 哪些 scene 只能 internal-only

- `internal-prep-only`
- `boundary-clarification`
- `prerequisite-clarification`
- `dependency-clarification`
- `non-commitment-clarification`

## 哪些 scene 必须 review-before-send

- `review-before-send`
- 任何仍存在 boundary、prerequisite、dependency 或 risk 但尚未被 owner 明确拍板的表达

## 哪些表达只能 boundary-only / non-commitment

- 任何可能被误解成 commitment 的 exploratory wording
- 任何 prerequisite / dependency 尚未补齐的对外话术
- 任何需要先解释边界再继续推进的 clarification wording

## 已成形但仍需下一层

- 更细的 founder / sales / delivery conversation variants
- 更细的 objection-handling / walkthrough 第二层模板
- conversation 和更多沟通类 detail 页的 handoff

## 刻意未做

- 没有扩成完整 messaging / enablement 平台
- 没有扩成完整 sales battlecard / CRM 平台
- 没有新增 canonical conversation 主对象

## Freeze 结论

当前 conversation detail baseline 已经清楚：scene / intent / audience / sendability / boundary / evidence 的最小 contract 与 judgement-first 页面结构都已冻结；但它仍是第一轮局部 detail baseline，不是完整 messaging platform。
