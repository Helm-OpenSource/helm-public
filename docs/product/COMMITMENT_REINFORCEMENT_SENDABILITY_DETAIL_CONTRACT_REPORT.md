---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Commitment Reinforcement / Sendability Detail Contract Report

## 当前结论

本轮已经把 `commitment reinforcement / sendability` 详情页收成一版专用 reporting contract，但它仍然建立在现有 `Opportunity` commercial context 之上，不是新增 `CommitmentReinforcement` 或 `Sendability` canonical 主对象。

共享 contract 入口在：

- `lib/presentation/commitment-reinforcement-sendability-detail-contract.ts`
- `features/commitment-reinforcement-sendability/detail-model.ts`

## Commitment reinforcement detail 核心语义

Commitment reinforcement detail 当前固定收口为：

- `reinforcementPageJudgement`
- `reinforcementPageJudgementReason`
- `reinforcementPageActionSummary`
- `reinforcementPageDecisionRequest`
- `reinforcementPageBoundarySummary`
- `reinforcementPageEvidenceSummary`
- `reinforcementPageWorkerSummary`
- `reinforcementPageNextAction`
- `reinforcementPageRiskSignal`
- `reinforcementPageStrengthMode`

同时固定保留：

- `reinforcementPageSendabilityMode`
- `reinforcementPageCustomerVisibleCue`
- `reinforcementPageInternalOnlyCue`
- `reinforcementPageNonCommitmentCue`

这让页面能稳定回答：

1. Helm 当前建议强化到什么程度
2. 当前到底是 `no-reinforcement`、`boundary-only-reinforcement`、`customer-visible-reinforcement`、`reinforcement-after-review`、`reinforcement-after-risk-reduction`、`reinforcement-blocked` 还是 `reinforcement-deferred`
3. 哪些 strengthening cue 可以进入 customer-visible 版本
4. 哪些 strengthening cue 仍然只适合 internal-only
5. recommendation、discussion-only 和 boundary-only reinforcement 为什么仍不等于 commitment

## Sendability detail 核心语义

Sendability detail 当前固定收口为：

- `sendabilityPageJudgement`
- `sendabilityPageJudgementReason`
- `sendabilityPageActionSummary`
- `sendabilityPageDecisionRequest`
- `sendabilityPageBoundarySummary`
- `sendabilityPageEvidenceSummary`
- `sendabilityPageWorkerSummary`
- `sendabilityPageNextAction`
- `sendabilityPageRiskSignal`
- `sendabilityPageMode`

同时固定保留：

- `sendabilityPageStrengthMode`
- `sendabilityPageCustomerVisibleCue`
- `sendabilityPageInternalOnlyCue`
- `sendabilityPageNonCommitmentCue`

这让 sendability 页能稳定承接：

1. 当前是 `safe-to-send`、`safe-with-boundary`、`safe-with-prerequisite`、`safe-with-dependency`、`safe-with-risk-note`、`discussion-only`、`review-before-send`、`not-safe-to-send` 还是 `internal-only`
2. 当前下一道 send gate 由谁接
3. 当前为什么仍不能越过 review / approval / boundary
4. send-safe 为什么不等于 commitment-safe

## 放置规则

首屏默认承载：

- 当前 judgement
- judgement reason
- 2 到 3 条 `Why it matters`
- Helm 已推进动作
- 当前 decision request
- boundary summary
- reinforcement / sendability judgement
- 当前 worker summary

Secondary summary 承载：

- current stage
- current owner
- risk signal
- due date
- reinforcement cue
- customer-visible cue
- internal-only cue
- non-commitment cue

Evidence drawer 承载：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- reinforcement trace
- historical changes

Internal-only 承载：

- trust-sensitive strengthening note
- 未收口的 scope / dependency / risk mitigation 修正说明
- 仍未过 review 的 customer-visible strengthening 候选

可进入 customer-visible strengthening cue 的内容：

- 明确可回退的价值强化句
- 带 boundary 的下一步推动句
- safe-with-prerequisite / safe-with-dependency 的外部可讨论版本

必须降级为 boundary / prerequisite / dependency / non-commitment note 的内容：

- 任何可能被误解成正式承诺的 strengthening 句
- prerequisite 未完成时的过度确定表达
- 仍依赖 delivery / review / approval 的 hard promise
- 仍需 review-before-send 或 not-safe-to-send 的 send gate 限制

## 当前边界

- 当前 contract 仍是 `Opportunity-derived reinforcement/sendability detail`，不是新增 reinforcement/sendability 主对象
- 当前 contract 只服务 strengthening / send gate judgement-first detail 页，不是完整 contract engine
- 当前 sendability judgement 只表示页面判断，不表示系统已经获得自动外发权
- 当前 reinforcement cue 只表示表达强度，不表示系统已经获得高风险自动承诺权
