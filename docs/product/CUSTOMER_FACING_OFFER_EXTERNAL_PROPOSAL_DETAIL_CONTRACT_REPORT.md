---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Offer / External Proposal Detail Contract Report

## 当前结论

本轮已经把 `customer-facing offer / external proposal` 详情页收成一版专用 reporting contract，但它仍然建立在现有 `Opportunity` commercial context 之上，不是新增 `Offer` 或 `ExternalProposal` canonical 主对象。

共享 contract 入口在：

- `lib/presentation/customer-facing-offer-external-proposal-detail-contract.ts`
- `features/customer-facing-offer-external-proposal/detail-model.ts`

## Customer-facing Offer detail 核心语义

Customer-facing offer detail 当前固定收口为：

- `customerOfferPageJudgement`
- `customerOfferPageJudgementReason`
- `customerOfferPageActionSummary`
- `customerOfferPageDecisionRequest`
- `customerOfferPageBoundarySummary`
- `customerOfferPageEvidenceSummary`
- `customerOfferPageWorkerSummary`
- `customerOfferPageNextAction`
- `customerOfferPageRiskSignal`
- `customerOfferPageSendabilityMode`

同时固定保留：

- `customerOfferPageCustomerFacingCue`
- `customerOfferPageInternalOnlyCue`
- `customerOfferPageNonCommitmentCue`

这让页面能稳定回答：

1. Helm 当前建议怎么对外说
2. 当前是否 safe-to-send、safe-with-boundary、safe-with-prerequisite、safe-with-dependency、discussion-only、review-before-send 或 not-safe-to-send
3. 哪些 wording 可以进入 customer-facing 语义
4. 哪些 wording 仍必须 internal-only
5. recommendation / boundary note 为什么仍不等于 commitment

## External Proposal detail 核心语义

External proposal detail 当前固定收口为：

- `externalProposalPageJudgement`
- `externalProposalPageJudgementReason`
- `externalProposalPageActionSummary`
- `externalProposalPageDecisionRequest`
- `externalProposalPageBoundarySummary`
- `externalProposalPageEvidenceSummary`
- `externalProposalPageWorkerSummary`
- `externalProposalPageNextAction`
- `externalProposalPageRiskSignal`
- `externalProposalPageSendabilityMode`

同时额外固定：

- `externalProposalPageCustomerFacingCue`
- `externalProposalPageInternalOnlyCue`
- `externalProposalPageNonCommitmentCue`
- `externalProposalPageCollaborationMode`
- `externalProposalPageCollaborationSummary`
- `externalProposalPageCollaborationRequest`
- `externalProposalPageCollaborationNextStep`
- `externalProposalPageCollaborationOwner`

这让 external proposal 页能更稳定承接：

1. sendability judgement
2. review-before-send gate
3. founder / sales / delivery 共审责任
4. discussion-only 与 reinforcement 的分层

## 放置规则

首屏默认承载：

- 当前 judgement
- judgement reason
- 2 到 3 条 `Why it matters`
- Helm 已推进动作
- 当前 decision request 或 collaboration request
- boundary summary
- sendability summary
- 当前 worker summary

Secondary summary 承载：

- current stage
- current owner
- risk signal
- due date
- customer-facing cue / internal-only cue / non-commitment cue

Evidence drawer 承载：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- historical changes

Internal-only 承载：

- trust-sensitive review note
- 未收口的 scope / dependency 修正说明
- 仍未过审批的对外强化表达

可进入 customer-facing cue 的内容：

- external-safe value framing
- safe-with-boundary 的柔性说明
- safe-with-prerequisite / safe-with-dependency 的外部可讨论版本

必须降级为 boundary / prerequisite / dependency / non-commitment note 的内容：

- 任何可能被误听成正式承诺的 wording
- 未完成 prerequisite 时的过度确定表达
- 仍依赖 delivery / approval 的 hard promise
- 仍需 review-before-send 的 sendability 限制

## 当前边界

- 当前 contract 仍是 `Opportunity-derived external expression detail`，不是新增 Offer / ExternalProposal 主对象
- 当前 contract 只服务外部表达 detail 模板页，不是完整 offer platform
- 当前 sendability judgement 只表示页面判断，不表示系统已经获得自动外发权
- 当前 recommendation、discussion-only、boundary note、reinforcement cue 仍必须继续与 commitment 严格分开
