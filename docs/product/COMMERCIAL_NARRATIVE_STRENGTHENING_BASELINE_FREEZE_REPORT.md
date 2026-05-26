---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Commercial Narrative Strengthening Baseline Freeze Report

## 目标

把当前 `commercial narrative strengthening` 收成一个明确、可复用、可培训的 strengthening 基线。

## 当前基线语义

当前已经冻结的核心语义：

- `strengtheningJudgement`
- `strengtheningJudgementReason`
- `strengtheningActionSummary`
- `strengtheningDecisionRequest`
- `strengtheningBoundarySummary`
- `strengtheningEvidenceSummary`
- `strengtheningWorkerSummary`
- `strengtheningNextAction`
- `strengtheningRiskSignal`
- `strengtheningLevel`
- `strengtheningIntent`
- `strengtheningAudienceMode`
- `strengtheningFallbackMode`

## 当前已冻结的 strengthening 模式

- `recommendation-only`
- `exploratory-strengthening`
- `pilot-strengthening`
- `customer-visible-light`
- `customer-visible-structured`
- `review-before-send`
- `risk-reduction-required`
- `boundary-only`
- `non-commitment-fallback`
- `blocked-strengthening`

## 当前表达边界

当前版本已经清楚：

- 哪些 strengthening 可以 customer-visible：
  - `customer-visible-light`
  - `customer-visible-structured`
  - 部分 `pilot-strengthening`
- 哪些只能 internal-only：
  - `recommendation-only`
  - `exploratory-strengthening`
  - `boundary-only`
  - `blocked-strengthening`
- 哪些必须 `review-before-send`
- 哪些必须停在 `recommendation-only`
- 哪些必须降级到 `non-commitment-fallback`

## 页面层级规则

- 首屏必须可见：
  - judgement
  - why it matters
  - Helm did
  - decision request
  - boundary
  - worker summary
- secondary summary 承载：
  - strengthening level
  - audience
  - intent
  - sendability
  - fallback
  - customer-visible / internal-only cue
- `EvidenceDrawer` 默认折叠，承载：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - strengthening trace
  - fallback trace
  - historical changes

## 刻意未做

- 没有新增 canonical `commercial narrative strengthening` 主对象
- 没有扩成完整 commercial engine
- 没有扩成完整 contract engine 或 legal review 平台
- 没有把 strengthening 变成自动外发或自动承诺平面

## Freeze 结论

当前 `commercial narrative strengthening` 基线已经清楚，可以作为下一阶段更细 strengthening 层次拆分与 commercial detail 扩展的正式起点；但仍必须继续保持“第一轮 strengthening detail baseline，而非 commercial / contract engine”的口径。
