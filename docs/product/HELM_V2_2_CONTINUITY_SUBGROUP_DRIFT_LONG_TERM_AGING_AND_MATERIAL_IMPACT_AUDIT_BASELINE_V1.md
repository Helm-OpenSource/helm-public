---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift Long-Term Aging And Material Impact Audit Baseline v1

更新时间：2026-04-05
状态：Baseline
适用范围：PR40 continuity subgroup drift long-term sample expansion / cross-readout interval wording regression audit / material impact sampling aging audit slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 long-horizon sample expansion / cross-readout audit / impact aging audit truth：

`subgroup drift long-term sample expansion review -> cross-readout interval wording regression audit -> material impact sampling aging audit -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_IMPACT_AGING_REFINEMENT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_IMPACT_AGING_REFINEMENT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_LONG_TERM_AGING_AND_MATERIAL_IMPACT_AUDIT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup drift long-term sample expansion review

- continuity pilot review 现在会显式输出：
  - `subgroupDriftLongTermSampleExpansionReview.summary`
  - `subgroupDriftLongTermSampleExpansionReview.aggregateSummary`
  - `subgroupDriftLongTermSampleExpansionReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupDriftLongTermSampleExpansionSummary`
- 当前读法会把 subgroup drift 放回更长 horizon 和更广 sample expansion 的对照里，避免把局部 holding / risk pocket 写成全局稳定性。

### 3.2 Cross-readout interval wording regression audit

- continuity pilot review 现在会显式输出：
  - `intervalWordingCrossReadoutRegressionAudit.regressionRate`
  - `intervalWordingCrossReadoutRegressionAudit.summary`
  - `intervalWordingCrossReadoutRegressionAudit.aggregateSummary`
  - `intervalWordingCrossReadoutRegressionAudit.findings`
  - `intervalWordingCrossReadoutRegressionAudit.adjustmentRecommendations`
- session-level `pilotReview` 现在会带：
  - `intervalWordingCrossReadoutAuditSummary`
- 当前读法会把 threshold / step / guideline 这三层 continuity readout 一起复核，而不是只看 surface consistency pass-rate。

### 3.3 Material impact sampling aging audit

- continuity pilot review 现在会显式输出：
  - `materialImpactSamplingAgingAudit.summary`
  - `materialImpactSamplingAgingAudit.aggregateSummary`
  - `materialImpactSamplingAgingAudit.findings`
  - `materialImpactSamplingAgingAudit.optimizationSuggestions`
- session-level `pilotReview` 现在会带：
  - `materialImpactSamplingAgingAuditSummary`
- 当前读法会把 longer-horizon impact signal 拆成 durable、watch 和 unstable，避免把 sampling aging 误写成 durable operator rule。

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 在更长期 sample expansion 下是 expanded-holding、watch，还是 expansion-risk
    - 当前 interval wording 在 threshold、step、guideline 这些 continuity readout 上是 live regression 还是 coverage gap
    - 当前 SOP material impact sampling 在更长 horizon 下是 durable、watch，还是 unstable
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup drift long-term sample expansion review
  - `continuity-threshold-revision-card` 现在会显式显示 cross-readout interval wording regression audit
  - `continuity-drift-card` 现在会显式显示 material impact sampling aging audit
  - continuity queue `pilotReviewSummary` 现在会把 `sample expansion / readout audit / impact audit` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase20`
  - `eval:helm-v2-2-continuity-subgroup-drift-long-term-aging-material-impact-audit`
- PR40 eval 会覆盖：
  - subgroup drift long-term sample expansion review
  - cross-readout interval wording regression audit
  - material impact sampling aging audit
  - session-level PR40 review coverage
- e2e 会覆盖：
  - meeting detail 的 sample expansion / readout audit / impact audit 文案
  - `/operating` 的 sample expansion、readout audit、impact audit cards 和 queue summary

## 4. 已成形但仍需下一层

- current subgroup drift long-term sample expansion review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- cross-readout wording regression audit 仍然是 operator-readable continuity consistency layer，不是独立 wording governance platform
- material impact sampling aging audit 仍然只表达 longer-horizon signal / hint，不表达 SOP 因果已经成立
- operator guidance 仍然是 bounded review layer，不是 auto-remediation

## 5. 刻意未做

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

## 6. 风险项

1. subgroup drift long-term sample expansion review 如果后续 sample 扩大但 findings 不同步更新，仍可能把局部 risk pocket 写成全局稳定性
2. cross-readout wording regression audit 如果新增 continuity readout 不复用 canonical wording，coverage gap 仍可能回来
3. material impact sampling aging audit 如果不持续对照 subgroup drift 和 local evidence，仍可能把 unstable hint 误读成 durable impact truth

## 7. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no route/query rewrite
