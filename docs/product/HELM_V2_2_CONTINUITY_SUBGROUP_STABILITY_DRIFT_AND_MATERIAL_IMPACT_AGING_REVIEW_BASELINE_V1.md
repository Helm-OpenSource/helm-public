---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Stability Drift And Material Impact Aging Review Baseline v1

更新时间：2026-04-05  
状态：Baseline  
适用范围：PR36 continuity subgroup stability drift / interval wording aging-regression audit / material impact pattern aging review slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 aging truth：

`subgroup scale-up recheck -> longer-horizon subgroup drift comparison -> interval wording aging / regression audit -> material impact pattern aging review -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_PILOT_SCALE_UP_RECHECK_AND_MATERIAL_IMPACT_AUDIT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_SCALE_UP_RECHECK_AND_MATERIAL_IMPACT_AUDIT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_STABILITY_DRIFT_AND_MATERIAL_IMPACT_AGING_REVIEW_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup stability drift review

- continuity pilot review 现在会显式输出：
  - `subgroupStabilityDriftReview.summary`
  - `subgroupStabilityDriftReview.aggregateSummary`
  - `subgroupStabilityDriftReview.findings`
- session-level `pilotReview` 现在会带：
  - `subgroupStabilityDriftSummary`
- 当前读法会把 subgroup 的 steady / watch / drifting aging posture 拆开显示，而不是只停在 scale-up recheck 是否存在

### 3.2 Interval wording aging / regression audit

- continuity pilot review 现在会显式输出：
  - `intervalWordingAgingAudit.regressionRate`
  - `intervalWordingAgingAudit.summary`
  - `intervalWordingAgingAudit.aggregateSummary`
  - `intervalWordingAgingAudit.findings`
- session-level `pilotReview` 现在会带：
  - `intervalWordingAgingSummary`
- 当前读法会把 canonical wording 是否仍持续稳定、是否出现 wording regression 单独拆开，而不是只停在当前 drift tracking

### 3.3 Material impact pattern aging review

- continuity pilot review 现在会显式输出：
  - `materialImpactPatternAgingReview.summary`
  - `materialImpactPatternAgingReview.aggregateSummary`
  - `materialImpactPatternAgingReview.patterns`
  - `materialImpactPatternAgingReview.optimizationHints`
- session-level `pilotReview` 现在会带：
  - `materialImpactPatternAgingSummary`
- aging review 现在会把 persistent / fading / unstable pattern 拆开，避免把当前 material impact audit 误写成 durable rule

### 3.4 Operator insight surfaces

- meeting detail：
  - `continuity-pilot-review` 现在能回答：
    - 当前 session 落在哪个 subgroup drift review
    - 当前 interval wording aging / regression 是否仍稳定
    - 当前 material impact pattern 是 persistent、fading，还是仍 unstable
- `/operating`：
  - `continuity-pilot-cases-card` 现在会显式显示 subgroup stability drift review
  - `continuity-threshold-revision-card` 现在会显式显示 interval wording aging audit
  - `continuity-drift-card` 现在会显式显示 material impact pattern aging review
  - continuity queue `pilotReviewSummary` 现在会把 `subgroup drift / wording aging / impact aging` 收成一条 operator-readable summary

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase16`
  - `eval:helm-v2-2-continuity-subgroup-stability-drift-material-impact-aging-review`
- PR36 eval 会覆盖：
  - subgroup stability drift review
  - interval wording aging audit
  - material impact pattern aging review
  - session-level PR36 review coverage
- e2e 会覆盖：
  - meeting detail 的 subgroup drift / wording aging / material impact aging 文案
  - `/operating` 的 subgroup drift、wording aging、material impact aging cards

## 4. 已成形但仍需下一层

- current subgroup drift review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- interval wording aging audit 仍然是 operator-readable consistency layer，不是独立 wording governance platform
- material impact pattern aging review 仍然只表达 longer-horizon pattern persistence / fade，不表达 SOP 因果已经成立
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

1. subgroup drift review 如果后续 sample 扩大但 cohort-specific findings 不同步更新，仍可能把局部 aging fluctuation 写成全局 drift
2. interval wording aging audit 如果新增 surface 不复用 canonical wording，regression 仍可能重新出现
3. material impact pattern aging review 如果不持续对照 subgroup stability，仍可能把 fading hint 误读成 durable impact truth

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
