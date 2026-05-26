---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Package Stage Variants Baseline Freeze Report

## 目标

把当前 `package stage variants` 收成一个明确、可复用、可培训的阶段基线。

## 当前基线语义

当前已经冻结的核心语义：

- `packageStageJudgement`
- `packageStageJudgementReason`
- `packageStageActionSummary`
- `packageStageDecisionRequest`
- `packageStageBoundarySummary`
- `packageStageEvidenceSummary`
- `packageStageWorkerSummary`
- `packageStageNextAction`
- `packageStageRiskSignal`
- `packageStageAudienceMode`
- `packageStageIntent`
- `packageStageMode`

## 当前已冻结的 stage 模式

- `exploratory`
- `exploratory-with-boundary`
- `exploratory-with-prerequisite`
- `exploratory-with-dependency`
- `pilot-ready`
- `pilot-expansion`
- `customer-visible-light`
- `customer-visible-structured`
- `review-before-send`
- `boundary-only`
- `dependency-blocked`
- `prerequisite-blocked`

## 当前表达边界

当前版本已经清楚：

- 哪些 stage 适合 customer-facing：
  - `customer-visible-light`
  - `customer-visible-structured`
  - 一部分 `pilot-ready` / `pilot-expansion`
- 哪些 stage 只能 internal-only：
  - `exploratory`
  - `exploratory-with-*`
  - `boundary-only`
  - `dependency-blocked`
  - `prerequisite-blocked`
- 哪些必须 `review-before-send`
- 哪些必须继续保留 non-commitment、boundary、prerequisite、dependency 说明

## 页面层级规则

- 首屏必须可见：
  - judgement
  - why it matters
  - Helm did
  - decision request
  - boundary
  - worker summary
- secondary summary 承载：
  - stage mode
  - audience
  - intent
  - sendability
  - customer-visible / internal-only cue
- `EvidenceDrawer` 默认折叠，承载：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - stage trace
  - historical changes

## 刻意未做

- 没有新增 canonical `package stage variant` 主对象
- 没有扩成完整 package engine
- 没有扩成完整报价、deal desk 或 contract 体系
- 没有把所有 commercial detail 页都重写成更细的 stage 分层

## Freeze 结论

当前 `package stage variants` 基线已经清楚，可以作为下一阶段更细 stage 变体拆分和 detail chain 扩展的正式起点；但仍必须继续保持“第一轮 detail baseline，而非 package engine”的口径。
