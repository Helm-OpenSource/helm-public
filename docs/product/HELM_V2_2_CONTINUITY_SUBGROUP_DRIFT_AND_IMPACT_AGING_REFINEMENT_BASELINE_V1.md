---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Drift And Impact Aging Refinement Baseline v1

更新时间：2026-04-05
状态：Baseline
适用范围：PR39 continuity subgroup drift long-term cohort aging / cross-surface interval wording regression audit / material impact sampling aging refinement slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 long-horizon aging / regression / refinement truth：

`subgroup drift long-term cohort aging review -> cross-surface interval wording regression audit -> material impact sampling aging refinement -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AGING_AND_MATERIAL_IMPACT_AUDIT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AGING_AND_MATERIAL_IMPACT_AUDIT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_IMPACT_AGING_REFINEMENT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup drift long-term cohort aging review

- continuity pilot review 现在会显式输出：
  - `subgroupDriftLongTermCohortAgingReview.summary`
  - `subgroupDriftLongTermCohortAgingReview.aggregateSummary`
  - `subgroupDriftLongTermCohortAgingReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupDriftLongTermCohortAgingSummary`
- 当前读法会把 subgroup drift 放回更长 horizon 和更大 cohort aging 的对照里，避免把局部 aging fluctuation 写成全局稳定性。

### 3.2 Cross-surface interval wording regression audit

- continuity pilot review 现在会显式输出：
  - `intervalWordingCrossSurfaceRegressionAudit.regressionRate`
  - `intervalWordingCrossSurfaceRegressionAudit.summary`
  - `intervalWordingCrossSurfaceRegressionAudit.aggregateSummary`
  - `intervalWordingCrossSurfaceRegressionAudit.findings`
  - `intervalWordingCrossSurfaceRegressionAudit.adjustmentRecommendations`
- session-level `pilotReview` 现在会带：
  - `intervalWordingRegressionAuditSummary`
- 当前读法会把 meeting detail、queue、operator panel、runbook 的 wording drift 和 coverage gap 一起复核，而不是只看 consistency pass-rate。

### 3.3 Material impact sampling aging refinement

- continuity pilot review 现在会显式输出：
  - `materialImpactSamplingAgingRefinement.summary`
  - `materialImpactSamplingAgingRefinement.aggregateSummary`
  - `materialImpactSamplingAgingRefinement.findings`
  - `materialImpactSamplingAgingRefinement.optimizationHints`
- session-level `pilotReview` 现在会带：
  - `materialImpactAgingRefinementSummary`
- 当前读法会把 longer-horizon impact signal 拆成 persistent signal、watch signal 和 unstable hint，避免把 sampling aging 误写成 durable operator rule。

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 在更长期 cohort aging 下是否仍然 broad-holding、aging-drift，还是正在继续 weakening
    - 当前 interval wording 在 continuity-facing readout 上是 live regression 还是 coverage gap
    - 当前 SOP material impact sampling 在更长 horizon 下是 persistent signal、watch，还是 unstable hint
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup drift long-term cohort aging review
  - `continuity-threshold-revision-card` 现在会显式显示 cross-surface interval wording regression audit
  - `continuity-drift-card` 现在会显式显示 material impact sampling aging refinement
  - continuity queue `pilotReviewSummary` 现在会把 `long-term aging / wording audit / impact refinement` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase19`
  - `eval:helm-v2-2-continuity-subgroup-drift-impact-aging-refinement`
- PR39 eval 会覆盖：
  - subgroup drift long-term cohort aging review
  - cross-surface interval wording regression audit
  - material impact sampling aging refinement
  - session-level PR39 review coverage
- e2e 会覆盖：
  - meeting detail 的 long-term aging / wording audit / impact refinement 文案
  - `/operating` 的 long-term aging、wording audit、impact refinement cards 和 queue summary

## 4. 已成形但仍需下一层

- current subgroup drift long-term cohort aging review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- cross-surface wording regression audit 仍然是 operator-readable continuity consistency layer，不是独立 wording governance platform
- material impact sampling aging refinement 仍然只表达 longer-horizon signal / hint，不表达 SOP 因果已经成立
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

1. subgroup drift long-term cohort aging review 如果后续 sample 扩大但 findings 不同步更新，仍可能把局部 aging fluctuation 写成全局稳定性
2. cross-surface wording regression audit 如果新增 continuity surface 不复用 canonical wording，coverage gap 仍可能回来
3. material impact sampling aging refinement 如果不持续对照 subgroup drift 和 local evidence，仍可能把 unstable hint 误读成 durable impact truth

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
