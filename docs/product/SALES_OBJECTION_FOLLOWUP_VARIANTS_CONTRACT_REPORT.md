---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Sales Objection / Follow-up Variants Contract Report

## 目标

把 `sales conversation` 继续细分成一组可复用的 sales objection / follow-up detail contract，用来承接跟进、异议回复、proposal clarification 以及 boundary / prerequisite / dependency / non-commitment clarification。

## 当前冻结的核心语义

- `salesObjectionJudgement`
- `salesObjectionReason`
- `salesObjectionBoundary`
- `salesObjectionNextAction`
- `salesObjectionEvidence`
- `salesObjectionScene`
- `salesObjectionAudience`
- `salesObjectionSendability`
- `salesObjectionFallback`
- `salesObjectionReviewMode`

本轮也同步固定了辅助语义：

- `salesObjectionActionSummary`
- `salesObjectionDecisionRequest`
- `salesObjectionWorkerSummary`
- `salesObjectionRiskSignal`
- `salesObjectionEvidenceGroups`

## 最小 scene 集

- `post-first-contact-follow-up`
- `post-demo-follow-up`
- `objection-reply`
- `proposal-clarification`
- `boundary-clarification`
- `prerequisite-clarification`
- `dependency-clarification`
- `non-commitment-clarification`
- `internal-only-prep`
- `review-before-send`

## 放置规则

首屏必须保留：

- judgement
- scene
- sendability
- fallback
- review mode
- 主边界句
- 当前 `next action`

`EvidenceDrawer` 只承接：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- objection trace
- follow-up trace
- historical changes

必须降级到 boundary / prerequisite / dependency / non-commitment note 的内容：

- 任何可能被误听成 commitment 的 sales wording
- 仍依赖 founder / delivery / approval 的跟进句子
- 仍需要 review-before-send 的高压 objection reply

## 当前成立程度

已经完整成立：

- Sales objection / follow-up detail contract
- scene / sendability / fallback / review mode 的最小词汇表

已成形但仍需下一层：

- 更细 objection tree
- 更细 follow-up cadence tree
- 与 sales pack / email draft 的更细绑定

刻意未做：

- 不把它扩成完整 sales enablement 平台
- 不把它扩成完整 CRM / battlecard 平台

风险项：

- sales wording 最容易因为“推进压力”滑向 commitment，所以 fallback 和 boundary 仍必须前置
