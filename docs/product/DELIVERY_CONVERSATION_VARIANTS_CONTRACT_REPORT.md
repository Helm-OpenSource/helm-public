---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Delivery Conversation Variants Contract

## 结论

本轮已把 delivery conversation variants 收成一版可复用的 detail reporting contract。它服务的是 delivery 在 onboarding walkthrough、activation confirmation、pilot review、proposal review、risk clarification、boundary clarification、next-step discussion、internal prep 和 review-before-send 之间的 judgement-first 切换，而不是完整 delivery enablement 或 ops 平台。

## 当前基线

- 核心字段已经固定：
  - `deliveryConversationJudgement`
  - `deliveryConversationJudgementReason`
  - `deliveryConversationActionSummary`
  - `deliveryConversationDecisionRequest`
  - `deliveryConversationBoundarySummary`
  - `deliveryConversationEvidenceSummary`
  - `deliveryConversationWorkerSummary`
  - `deliveryConversationNextAction`
  - `deliveryConversationRiskSignal`
  - `deliveryConversationAudienceMode`
  - `deliveryConversationIntent`
  - `deliveryConversationScene`
  - `deliveryConversationSendabilityMode`
- delivery scene 当前固定为：
  - `delivery-onboarding-walkthrough`
  - `delivery-activation-confirmation`
  - `delivery-pilot-review`
  - `delivery-proposal-review`
  - `delivery-risk-clarification`
  - `delivery-boundary-clarification`
  - `delivery-next-step-discussion`
  - `delivery-internal-prep-only`
  - `delivery-review-before-send`

## 放置规则

- 首屏必须保留：
  - current judgement
  - judgement reason
  - delivery scene
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
  - walkthrough trace
  - historical changes
- 只适合 internal-only：
  - internal prep explanation
  - 尚未过 review 的 rollout confidence
  - 会被误读成正式承诺的更强 delivery wording
- 可以进入 customer-facing cue：
  - onboarding walkthrough
  - activation confirmation
  - pilot review
  - next-step discussion
  - 前提是 boundary / prerequisite / dependency / non-commitment 仍显式可见
- 必须降级为 boundary / prerequisite / dependency / non-commitment note：
  - 任何可能让客户误把实施解释读成 scope / timing 承诺的 delivery 句子

## 边界

- 已完整成立的是 delivery scene / boundary / sendability 的 detail contract。
- 仍未做的是完整 delivery enablement、ops orchestration 或交付执行平面。
- `recommendation != commitment` 在 delivery contract 中继续保持硬边界。
