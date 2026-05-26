---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Founder Conversation Variants Contract

## 结论

本轮已把 founder conversation variants 收成一版可复用的 detail reporting contract。它服务的是 founder 在首次会面、demo、next-phase framing、客户 Q&A、boundary clarification、internal prep 和 review-before-send 之间的 judgement-first 切换，而不是完整 founder enablement 平台。

## 当前基线

- 核心字段已经固定：
  - `founderConversationJudgement`
  - `founderConversationJudgementReason`
  - `founderConversationActionSummary`
  - `founderConversationDecisionRequest`
  - `founderConversationBoundarySummary`
  - `founderConversationEvidenceSummary`
  - `founderConversationWorkerSummary`
  - `founderConversationNextAction`
  - `founderConversationRiskSignal`
  - `founderConversationAudienceMode`
  - `founderConversationIntent`
  - `founderConversationScene`
  - `founderConversationSendabilityMode`
- founder scene 当前固定为：
  - `founder-first-meeting`
  - `founder-demo`
  - `founder-next-phase-framing`
  - `founder-customer-q-and-a`
  - `founder-boundary-clarification`
  - `founder-internal-prep-only`
  - `founder-review-before-send`

## 放置规则

- 首屏必须保留：
  - current judgement
  - judgement reason
  - founder scene
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
  - Q&A trace
  - historical changes
- 只适合 internal-only：
  - internal prep framing
  - review-before-send cue
  - 尚未过 founder review 的高信心表述
- 可以进入 customer-facing cue：
  - founder first meeting
  - founder demo
  - founder next-phase framing
  - founder customer Q&A
  - 前提是 boundary / non-commitment 仍显式可见
- 必须降级为 boundary / prerequisite / dependency / non-commitment note：
  - 任何可能被误读成正式承诺的 founder confidence

## 边界

- 已完整成立的是 founder scene / boundary / sendability 的 detail contract。
- 仍未做的是完整 founder enablement、battlecard 或 Q&A engine。
- `recommendation != commitment` 在 founder contract 中继续保持硬边界。
