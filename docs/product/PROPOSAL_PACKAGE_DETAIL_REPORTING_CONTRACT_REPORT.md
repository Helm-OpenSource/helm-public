---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Proposal / Package Detail Reporting Contract Report

## 当前结论

本轮已经把 `proposal / package` 详情页收成一版专用 reporting contract，但它仍然是基于现有 `Opportunity` 商业上下文派生出来的 detail contract，不是新增 canonical Proposal / Package 主对象。

共享 contract 入口在：

- `lib/presentation/proposal-package-detail-contract.ts`
- `features/proposal-package/detail-model.ts`

## Proposal detail 核心语义

Proposal detail 当前固定收口为：

- `proposalPageJudgement`
- `proposalPageJudgementReason`
- `proposalPageActionSummary`
- `proposalPageDecisionRequest`
- `proposalPageBoundarySummary`
- `proposalPageEvidenceSummary`
- `proposalPageWorkerSummary`
- `proposalPageNextAction`
- `proposalPageRiskSignal`
- `proposalPageAudienceMode`

Proposal detail 当前默认回答：

1. Helm 当前怎么看这版 proposal
2. 为什么它现在适合继续整形、继续内评，还是进入 customer-safe review
3. Helm 已经先整理了哪些 blocker / commitment / briefing context
4. 现在需要谁拍板
5. recommendation 为什么仍不等于 commitment

## Package detail 核心语义

Package detail 当前固定收口为：

- `packagePageJudgement`
- `packagePageJudgementReason`
- `packagePageActionSummary`
- `packagePageDecisionRequest`
- `packagePageBoundarySummary`
- `packagePageEvidenceSummary`
- `packagePageWorkerSummary`
- `packagePageNextAction`
- `packagePageRiskSignal`
- `packagePageAudienceMode`

同时，package detail 额外固定：

- `packagePageCollaborationMode`
- `packagePageCollaborationSummary`
- `packagePageCollaborationRequest`
- `packagePageCollaborationNextStep`
- `packagePageCollaborationOwner`

这让 package 页能更稳定承接 `sales / delivery review` 场景，而不退回到普通对象详情页。

## 放置规则

首屏默认承载：

- 当前 judgement
- judgement reason
- 2 到 3 条 `Why it matters`
- Helm 已推进动作
- 当前 decision request 或 collaboration request
- boundary summary
- 当前 worker summary

Secondary summary 承载：

- 当前 stage
- 当前 owner
- audience mode
- due date
- package collaboration owner

Evidence drawer 承载：

- replay
- audit
- memory
- worker output
- boundary trace
- historical changes

Internal-only 承载：

- 审批敏感 wording
- 信任敏感 dependency
- 仍未收口的 scope / delivery caution

Customer-facing cue 允许进入：

- customer-safe review 状态提示
- 下一步 external-safe 准备程度

必须降级成 boundary / prerequisite / dependency / non-commitment note 的内容：

- 任何可能被误听成正式承诺的 wording
- 尚未过 review 的 package scope
- 仍受审批约束的外发动作

## 当前边界

- 当前 contract 仍是 `Opportunity-derived commercial detail`，不是新增 Proposal / Package canonical object
- 当前 contract 只服务 proposal / package detail 模板页，不是完整 proposal platform
- 当前 customer-safe 只表示可进入 review，不表示可直接外发或可直接承诺
