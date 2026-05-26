---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Inbox / Follow-up / Review Request Detail Contract Report

本轮把 `inbox / follow-up / review request` 三类页收成同一套 detail reporting contract。

当前固定的最小核心语义包括：

- `inboxDetailJudgement`
- `inboxDetailJudgementReason`
- `inboxDetailActionSummary`
- `inboxDetailDecisionRequest`
- `inboxDetailBoundarySummary`
- `inboxDetailEvidenceSummary`
- `inboxDetailWorkerSummary`
- `inboxDetailNextAction`
- `inboxDetailRiskSignal`
- `inboxDetailAudienceMode`
- `inboxDetailScene`
- `inboxDetailSendabilityMode`

- `followupDetailJudgement`
- `followupDetailJudgementReason`
- `followupDetailActionSummary`
- `followupDetailDecisionRequest`
- `followupDetailBoundarySummary`
- `followupDetailEvidenceSummary`
- `followupDetailWorkerSummary`
- `followupDetailNextAction`
- `followupDetailRiskSignal`
- `followupDetailAudienceMode`
- `followupDetailScene`
- `followupDetailSendabilityMode`

- `reviewRequestDetailJudgement`
- `reviewRequestDetailJudgementReason`
- `reviewRequestDetailActionSummary`
- `reviewRequestDetailDecisionRequest`
- `reviewRequestDetailBoundarySummary`
- `reviewRequestDetailEvidenceSummary`
- `reviewRequestDetailWorkerSummary`
- `reviewRequestDetailNextAction`
- `reviewRequestDetailRiskSignal`
- `reviewRequestDetailAudienceMode`
- `reviewRequestDetailScene`
- `reviewRequestDetailSendabilityMode`

当前最小 scene 已覆盖：

- `inbox-customer-thread`
- `inbox-internal-thread`
- `followup-draft`
- `followup-ready-to-review`
- `followup-review-before-send`
- `review-request-pending`
- `review-request-escalated`
- `review-request-blocked`
- `internal-prep-only`

放置规则当前已经清楚：

- judgement / reason / action summary / decision request 属于首屏
- scene / audience / sendability / owner / next action 属于 secondary summary
- boundary / prerequisite / dependency / non-commitment 继续收在 `BoundaryNote`
- replay / audit / memory / worker output / boundary trace / sendability trace / handoff trace / historical changes 收在 `EvidenceDrawer`
- internal-only 线索、approver context、草稿注释不得直接抬成 customer-facing wording

这套 contract 的目标不是完整 inbox client、email client 或 review workflow，而是把这三类 detail 页变成统一的 judgement-first 沟通链节点。
