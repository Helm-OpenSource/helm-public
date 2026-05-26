---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift And Material Impact Aging Audit Refinement Baseline v1

更新时间：2026-04-05
状态：Baseline
适用范围：PR41 continuity subgroup drift long-term sample expansion refinement / interval wording cross-readout regression refinement / material impact sampling aging refinement audit slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 sample refinement / cross-readout refinement / impact refinement audit truth：

`subgroup drift long-term sample expansion refinement review -> cross-readout interval wording regression refinement -> material impact sampling aging refinement audit -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_LONG_TERM_AGING_AND_MATERIAL_IMPACT_AUDIT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_LONG_TERM_AGING_AND_MATERIAL_IMPACT_AUDIT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_MATERIAL_IMPACT_AGING_AUDIT_REFINEMENT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup drift long-term sample expansion refinement review

- continuity pilot review 现在会显式输出：
  - `subgroupDriftLongTermSampleExpansionRefinementReview.summary`
  - `subgroupDriftLongTermSampleExpansionRefinementReview.aggregateSummary`
  - `subgroupDriftLongTermSampleExpansionRefinementReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupDriftLongTermSampleExpansionRefinementSummary`
- 当前读法会把 subgroup drift 放回更细的 sample-depth posture，对 operator 明确区分 `deep-support / mixed-support / fragile-support`

### 3.2 Cross-readout interval wording regression refinement

- continuity pilot review 现在会显式输出：
  - `intervalWordingCrossReadoutRegressionRefinement.regressionRate`
  - `intervalWordingCrossReadoutRegressionRefinement.summary`
  - `intervalWordingCrossReadoutRegressionRefinement.aggregateSummary`
  - `intervalWordingCrossReadoutRegressionRefinement.findings`
  - `intervalWordingCrossReadoutRegressionRefinement.adjustmentRecommendations`
- session-level `pilotReview` 现在会带：
  - `intervalWordingCrossReadoutRegressionRefinementSummary`
- 当前读法会把 threshold / step / guideline 扩到 session summary / queue summary / operator card 这些 continuity readout family，而不是只停在 PR40 的 cross-readout audit

### 3.3 Material impact sampling aging refinement audit

- continuity pilot review 现在会显式输出：
  - `materialImpactSamplingAgingRefinementAudit.summary`
  - `materialImpactSamplingAgingRefinementAudit.aggregateSummary`
  - `materialImpactSamplingAgingRefinementAudit.findings`
  - `materialImpactSamplingAgingRefinementAudit.optimizationSuggestions`
- session-level `pilotReview` 现在会带：
  - `materialImpactSamplingAgingRefinementAuditSummary`
- 当前读法会把 longer-horizon impact signal 拆成 `durable-comparison / mixed-comparison / regressing-comparison`，避免把单次 sampling aging 误写成 durable operator rule

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 在 sample refinement 下是 deep-support、mixed-support，还是 fragile-support
    - 当前 interval wording 在 threshold、step、guideline、session summary、queue summary、operator card 这些 continuity readout family 上是 live regression 还是 coverage gap
    - 当前 SOP material impact sampling 在更长 horizon 下是 durable-comparison、mixed-comparison，还是 regressing-comparison
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup drift sample refinement
  - `continuity-threshold-revision-card` 现在会显式显示 cross-readout wording refinement
  - `continuity-drift-card` 现在会显式显示 material impact sampling aging refinement audit
  - continuity queue `pilotReviewSummary` 现在会把 `sample refinement / readout refinement / impact refinement audit` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase21`
  - `eval:helm-v2-2-continuity-subgroup-drift-material-impact-aging-audit-refinement`
- PR41 eval 会覆盖：
  - subgroup drift long-term sample expansion refinement review
  - cross-readout interval wording regression refinement
  - material impact sampling aging refinement audit
  - session-level PR41 review coverage
- e2e 会覆盖：
  - meeting detail 的 sample refinement / readout refinement / impact refinement audit 文案
  - `/operating` 的 sample refinement、readout refinement、impact refinement audit cards 和 queue summary

## 4. 已成形但仍需下一层

- current subgroup drift sample refinement 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- cross-readout wording refinement 仍然是 operator-readable continuity consistency layer，不是独立 wording governance platform
- material impact sampling aging refinement audit 仍然只表达 longer-horizon signal / hint，不表达 SOP 因果已经成立
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

1. subgroup drift sample refinement 如果后续 sample 扩大但 findings 不同步更新，仍可能把局部 fragile-support pocket 写成全局稳定性
2. cross-readout wording refinement 如果新增 continuity readout 不复用 canonical wording，session summary / queue summary / operator card 的 coverage gap 仍可能回来
3. material impact sampling aging refinement audit 如果不持续对照 subgroup drift 和 local evidence，仍可能把 regressing-comparison hint 误读成 durable impact truth

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
