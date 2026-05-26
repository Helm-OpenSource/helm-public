---
status: archived
owner: helm-core
created: 2026-03-28
review_after: 2026-09-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer Success Detail Baseline Freeze Report

## 当前 freeze 范围

当前 freeze 的 customer success detail contract 已固定以下核心语义：

- `customerSuccessDetailJudgement`
- `customerSuccessDetailReason`
- `customerSuccessDetailActionSummary`
- `customerSuccessDetailDecisionRequest`
- `customerSuccessDetailBoundarySummary`
- `customerSuccessDetailEvidenceSummary`
- `customerSuccessDetailWorkerSummary`
- `customerSuccessDetailNextAction`
- `customerSuccessDetailRiskSignal`
- `customerSuccessDetailAudienceMode`
- `customerSuccessDetailStage`
- `customerSuccessDetailSendabilityMode`
- `customerSuccessDetailFallbackMode`

## 当前版本固定基线

- judgement / reason / action / decision request 继续属于首屏
- boundary / prerequisite / dependency / non-commitment 继续属于首屏边界层
- worker summary 继续属于首屏行动层，不下沉到 evidence
- evidence 继续默认降级到 `EvidenceDrawer`
- replay / audit / memory / worker output / boundary trace / sendability trace / handoff trace / success trace / historical changes 继续只放在 evidence grouping
- review-before-send / not-ready-for-customer / internal-only 继续必须显式可见，不允许躲进次级注脚

## 首屏与 secondary summary 规则

### 首屏固定项

- Current Judgement
- Judgement reason
- Why it matters
- Helm did
- Decision / collaboration request
- Boundary summary
- Evidence summary
- Next action
- Risk cue
- Worker summary

### Secondary summary 固定项

- 当前 stage
- ownership
- audience mode
- sendability
- fallback
- review pressure

### EvidenceDrawer 固定项

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- handoff trace
- success trace
- historical changes

## internal-only / review-before-send 规则

- `internal-only` 只能作为内部接手与准备语义，不可直接抬成 customer-facing wording
- `review-before-send` 必须显式显示在首屏 boundary / sendability 语义中，不能只出现在 evidence
- `blocked-by-boundary`、`non-commitment fallback`、`review hold` 必须继续作为可见的降级方式，而不是隐藏在对象状态里

## 当前可扩展性

- 这套 detail contract 已足以承接当前 v1.1 的 `issue / escalation` 区分语义，并继续向更细子变体扩展
- judgement / action / boundary / evidence 骨架可以继续复用
- stage / sendability / fallback 结构已经可以支撑 derived `success queue / success inbox` 的薄运营面，并继续向更细 retell 延展

## 刻意未做

- 没有扩成完整 customer success operations engine
- 没有引入完整 queue management / task orchestration 平面
- 没有新增 canonical customer success 主对象

## Freeze 结论

当前 customer success detail contract 已形成可复用、可交付、可培训、可扩展的第一轮固定基线，但必须继续诚实保留以下口径：

- 它是第一轮 customer success detail baseline
- 它不是完整客户成功平台
- 它不是完整 CS ops engine
- 它仍建立在 existing opportunity / review / company context 上
