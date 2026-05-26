---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# External Narrative Detail Baseline Freeze Report

## 当前冻结范围

当前 external narrative detail baseline 冻结以下核心语义：

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

## 当前已成立的 narrative level 基线

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

## 当前基线规则

- 首屏默认先看 judgement、reason、Helm did、decision request、next action
- `level / audience / sendability / fallback / boundary` 默认继续可见
- replay / audit / memory / worker output / trace 默认降到 `EvidenceDrawer`
- external narrative 可以提高清晰度和信心，但它仍然不能悄悄把 recommendation 硬化成 commitment

## 哪些 narrative 可以 customer-visible

- `customer-visible-light`
- `customer-visible-structured`
- `proposal-supporting-narrative`
- `strengthening-narrative`

前提：

- boundary 已明确
- fallback 不停在 `non-commitment-fallback`
- sendability 不停在 `review-before-send` 或 `blocked`

## 哪些 narrative 只能 internal-only

- `internal-framing`
- `blocked-narrative`

## 哪些 narrative 必须 review-before-send

- `review-before-send`
- 任何仍依赖 founder / sales / delivery 最终拍板的 strengthening wording

## 哪些 narrative 必须停在 exploratory / boundary-only / fallback

- `exploratory-narrative`
- `boundary-only`
- `non-commitment-fallback`

## 已成形但仍需下一层

- 更细的 external narrative variants / fallback variants
- narrative level 与更多 detail chain 的连续 handoff
- 更完整的 founder / sales / delivery role-specific narrative detail

## 刻意未做

- 没有扩成完整 conversation / narrative engine
- 没有扩成完整 proposal generator
- 没有新增 canonical external narrative 主对象

## Freeze 结论

当前 external narrative detail baseline 已经清楚：level、fallback、audience、sendability、boundary 与 evidence contract 已冻结，并已落到 judgement-first 页面；但它仍是第一轮局部 detail baseline，不是完整 commercial conversation engine。
