---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift Aging And Material Impact Audit Baseline v1

更新时间：2026-04-05
状态：Baseline
适用范围：PR38 continuity subgroup drift aging / cross-surface interval wording consistency audit / material impact sampling aging review slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 aging / consistency / sampling truth：

`subgroup drift cohort aging scale-up review -> cross-surface interval wording consistency audit -> material impact sampling aging review -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_COHORT_AGING_AND_IMPACT_REVIEW_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_COHORT_AGING_AND_IMPACT_REVIEW_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AGING_AND_MATERIAL_IMPACT_AUDIT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup drift aging scale-up review

- continuity pilot review 现在会显式输出：
  - `subgroupDriftAgingScaleUpReview.summary`
  - `subgroupDriftAgingScaleUpReview.aggregateSummary`
  - `subgroupDriftAgingScaleUpReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupDriftAgingScaleUpSummary`
- 当前读法会把 subgroup drift 放回更大 cohort 和更长 horizon 的 scale-up aging 对照里，避免把局部 drift pocket 写成全局稳定性。

### 3.2 Cross-surface interval wording consistency audit

- continuity pilot review 现在会显式输出：
  - `intervalWordingCrossSurfaceConsistencyAudit.regressionRate`
  - `intervalWordingCrossSurfaceConsistencyAudit.summary`
  - `intervalWordingCrossSurfaceConsistencyAudit.aggregateSummary`
  - `intervalWordingCrossSurfaceConsistencyAudit.findings`
  - `intervalWordingCrossSurfaceConsistencyAudit.adjustmentRecommendations`
- session-level `pilotReview` 现在会带：
  - `intervalWordingConsistencyAuditSummary`
- 当前读法会把 meeting detail、queue、operator panel、runbook 的 canonical interval wording 一起复核，而不是只看单个 surface。

### 3.3 Material impact sampling aging review

- continuity pilot review 现在会显式输出：
  - `materialImpactSamplingAgingReview.summary`
  - `materialImpactSamplingAgingReview.aggregateSummary`
  - `materialImpactSamplingAgingReview.findings`
  - `materialImpactSamplingAgingReview.optimizationHints`
- session-level `pilotReview` 现在会带：
  - `materialImpactSamplingAgingSummary`
- 当前读法会把 broader-sample material signal、watch signal 和 unstable hint 拆开，避免把 sampling aging 误写成 durable rule。

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 在更大 cohort aging 下是 broad-holding、watch，还是 aging-drift
    - 当前 interval wording 在更多 continuity surface 上是否仍保持 canonical wording
    - 当前 material impact sampling 在更长 horizon 下是 persistent signal、watch，还是 unstable hint
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup drift aging scale-up review
  - `continuity-threshold-revision-card` 现在会显式显示 cross-surface interval wording consistency audit
  - `continuity-drift-card` 现在会显式显示 material impact sampling aging review
  - continuity queue `pilotReviewSummary` 现在会把 `aging scale-up / wording consistency / sampling aging` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase18`
  - `eval:helm-v2-2-continuity-subgroup-drift-aging-material-impact-audit`
- PR38 eval 会覆盖：
  - subgroup drift aging scale-up review
  - cross-surface interval wording consistency audit
  - material impact sampling aging review
  - session-level PR38 review coverage
- e2e 会覆盖：
  - meeting detail 的 aging scale-up / wording consistency / sampling aging 文案
  - `/operating` 的 aging scale-up、wording consistency、sampling aging cards

## 4. 已成形但仍需下一层

- current subgroup drift aging scale-up review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- cross-surface wording consistency audit 仍然是 operator-readable consistency layer，不是独立 wording governance platform
- material impact sampling aging review 仍然只表达 longer-horizon signal / hint，不表达 SOP 因果已经成立
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

1. subgroup drift aging scale-up review 如果后续 sample 扩大但 subgroup-specific findings 不同步更新，仍可能把局部 aging fluctuation 写成全局稳定性
2. cross-surface wording consistency audit 如果新增 surface 不复用 canonical wording，consistency audit 仍可能重新失效
3. material impact sampling aging review 如果不持续对照 subgroup drift 和 local evidence，仍可能把 unstable hint 误读成 durable impact truth

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
