---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Sales Conversation Variants Contract

## 结论

本轮已把 sales conversation variants 收成一版可复用的 detail reporting contract。它服务的是 sales 在 first contact、post-demo follow-up、objection handling、proposal walkthrough、boundary / prerequisite / dependency / non-commitment clarification、internal prep 和 review-before-send 之间的 judgement-first 切换，而不是完整 sales enablement 或 CRM 平台。

## 当前基线

- 核心字段已经固定：
  - `salesConversationJudgement`
  - `salesConversationJudgementReason`
  - `salesConversationActionSummary`
  - `salesConversationDecisionRequest`
  - `salesConversationBoundarySummary`
  - `salesConversationEvidenceSummary`
  - `salesConversationWorkerSummary`
  - `salesConversationNextAction`
  - `salesConversationRiskSignal`
  - `salesConversationAudienceMode`
  - `salesConversationIntent`
  - `salesConversationScene`
  - `salesConversationSendabilityMode`
- sales scene 当前固定为：
  - `sales-first-contact`
  - `sales-post-demo-follow-up`
  - `sales-objection-handling`
  - `sales-proposal-walkthrough`
  - `sales-boundary-clarification`
  - `sales-prerequisite-clarification`
  - `sales-dependency-clarification`
  - `sales-non-commitment-clarification`
  - `sales-internal-prep-only`
  - `sales-review-before-send`

## 放置规则

- 首屏必须保留：
  - current judgement
  - judgement reason
  - sales scene
  - decision request
  - boundary summary
  - next action
- 次级摘要保留：
  - audience mode
  - sendability mode
  - current owner / due date
- 只进 `EvidenceDrawer`：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - scene trace
  - follow-up trace
  - historical changes
- 只适合 internal-only：
  - internal prep follow-up
  - 尚未过 review 的 objection reply
  - 会被误读成承诺的更强 sales wording
- 可以进入 customer-facing cue：
  - first contact
  - post-demo follow-up
  - proposal walkthrough
  - objection handling
  - 前提是 boundary / prerequisite / dependency / non-commitment 仍显式可见
- 必须降级为 boundary / prerequisite / dependency / non-commitment note：
  - 任何可能让客户误以为 Helm 已正式承诺 scope、timing 或结果的 sales 句子

## 边界

- 已完整成立的是 sales scene / boundary / sendability 的 detail contract。
- 仍未做的是完整 sales enablement、battlecard、邮件发送或 CRM 编排。
- `recommendation != commitment` 在 sales contract 中继续保持硬边界。
