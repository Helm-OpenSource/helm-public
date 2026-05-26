---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# External Narrative Detail Contract Report

## 当前状态

当前 `external narrative` 已经不再只散落在 proposal note、strengthening note 和外部表达 cue 里。它现在被收成一份可复用的 detail reporting contract，用来承接：

- narrative level
- audience mode
- fallback mode
- sendability mode
- boundary / non-commitment
- next action / decision request
- worker / evidence grouping

## 当前版本基线

当前最小核心语义已经成立：

- `externalNarrativeDetailJudgement`
- `externalNarrativeDetailJudgementReason`
- `externalNarrativeDetailActionSummary`
- `externalNarrativeDetailDecisionRequest`
- `externalNarrativeDetailBoundarySummary`
- `externalNarrativeDetailEvidenceSummary`
- `externalNarrativeDetailWorkerSummary`
- `externalNarrativeDetailNextAction`
- `externalNarrativeDetailRiskSignal`
- `externalNarrativeDetailAudienceMode`
- `externalNarrativeDetailIntent`
- `externalNarrativeDetailLevel`
- `externalNarrativeDetailFallbackMode`
- `externalNarrativeDetailSendabilityMode`

当前最小模式已经明确：

- `internal-framing`
- `customer-visible-light`
- `customer-visible-structured`
- `exploratory-narrative`
- `proposal-supporting-narrative`
- `strengthening-narrative`
- `review-before-send`
- `boundary-only`
- `non-commitment-fallback`
- `blocked-narrative`

## 放置规则

当前首屏必须优先承载：

- 当前 judgement
- judgement reason
- Helm 已推进动作
- decision request
- boundary / fallback / sendability

当前次级摘要继续承载：

- audience mode
- narrative intent
- founder / sales / delivery cue
- current owner / due date

当前只进入 `EvidenceDrawer` 的内容：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- narrative trace
- fallback trace
- historical changes

## 当前边界

- external narrative detail 当前只是一版 judgement-first detail contract
- 它不是完整 external proposal generator
- 它不是完整 sales enablement / commercial engine
- 它不是 legal / contract engine
- recommendation、exploratory narrative、boundary-only、non-commitment fallback 仍然不等于 commitment

## 结论

`external narrative detail reporting contract` 当前已经清楚，足以支持第一轮 external narrative detail 页与后续更细 founder / sales / delivery external narrative 扩展，但仍只是第一轮可复用 detail contract，不是完整 narrative engine。
