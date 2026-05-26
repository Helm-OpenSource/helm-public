---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Drift Cohort Aging And Impact Review Baseline v1

更新时间：2026-04-05  
状态：Baseline  
适用范围：PR37 continuity subgroup drift cohort aging / cross-surface interval wording regression / material impact sampling review slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 cohort-aging truth：

`subgroup stability drift review -> cohort aging comparison -> cross-surface interval wording regression review -> material impact aging sampling review -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_STABILITY_DRIFT_AND_MATERIAL_IMPACT_AGING_REVIEW_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_STABILITY_DRIFT_AND_MATERIAL_IMPACT_AGING_REVIEW_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_COHORT_AGING_AND_IMPACT_REVIEW_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup drift cohort aging review

- continuity pilot review 现在会显式输出：
  - `subgroupCohortAgingReview.summary`
  - `subgroupCohortAgingReview.aggregateSummary`
  - `subgroupCohortAgingReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupCohortAgingSummary`
- 当前读法会把 subgroup drift 放回更长期 cohort aging 对照里，避免把局部 aging fluctuation 写成全局稳定性

### 3.2 Cross-surface interval wording regression review

- continuity pilot review 现在会显式输出：
  - `intervalWordingCrossSurfaceRegressionReview.regressionRate`
  - `intervalWordingCrossSurfaceRegressionReview.summary`
  - `intervalWordingCrossSurfaceRegressionReview.aggregateSummary`
  - `intervalWordingCrossSurfaceRegressionReview.findings`
  - `intervalWordingCrossSurfaceRegressionReview.adjustmentRecommendations`
- session-level `pilotReview` 现在会带：
  - `intervalWordingRegressionSummary`
- 当前读法会把 meeting detail、queue、operator panel、runbook 的 canonical interval wording 一起复核，而不是只看单个 surface

### 3.3 Material impact sampling review

- continuity pilot review 现在会显式输出：
  - `materialImpactSamplingReview.summary`
  - `materialImpactSamplingReview.aggregateSummary`
  - `materialImpactSamplingReview.findings`
  - `materialImpactSamplingReview.optimizationHints`
- session-level `pilotReview` 现在会带：
  - `materialImpactSamplingSummary`
- 当前读法会把 broader-sample material signal 与 narrow hint 拆开，避免把 sampling review 误写成 durable rule

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 在 cohort aging 里是 holding、watch，还是 aging-drift
    - 当前 interval wording 在跨 surface 上是否仍保持 canonical wording
    - 当前 material impact 是 broader-sample signal，还是 narrow hint
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup cohort aging review
  - `continuity-threshold-revision-card` 现在会显式显示 cross-surface interval wording regression review
  - `continuity-drift-card` 现在会显式显示 material impact sampling review
  - continuity queue `pilotReviewSummary` 现在会把 `cohort aging / wording regression / impact sampling` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase17`
  - `eval:helm-v2-2-continuity-subgroup-drift-cohort-aging-impact-review`
- PR37 eval 会覆盖：
  - subgroup cohort aging review
  - cross-surface interval wording regression review
  - material impact sampling review
  - session-level PR37 review coverage
- e2e 会覆盖：
  - meeting detail 的 cohort aging / wording regression / impact sampling 文案
  - `/operating` 的 cohort aging、wording regression、impact sampling cards

## 4. 已成形但仍需下一层

- current subgroup drift cohort aging review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- cross-surface wording regression review 仍然是 operator-readable consistency layer，不是独立 wording governance platform
- material impact sampling review 仍然只表达 longer-horizon signal / hint，不表达 SOP 因果已经成立
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

1. cohort aging review 如果后续 sample 扩大但 subgroup-specific findings 不同步更新，仍可能把局部 aging fluctuation 写成全局稳定性
2. cross-surface wording regression review 如果新增 surface 不复用 canonical wording，regression 仍可能重新出现
3. material impact sampling review 如果不持续对照 subgroup drift 和 local evidence，仍可能把 narrow hint 误读成 durable impact truth

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
