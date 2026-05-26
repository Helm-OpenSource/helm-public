---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Stability Recheck And Long-term Outcome Refinement Baseline v1

更新时间：2026-04-05  
状态：Baseline  
适用范围：PR33 continuity pilot stability recheck / interval wording consistency / long-term outcome refinement slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 review truth：

`larger pilot sample -> subgroup stability recheck -> interval wording consistency -> long-term outcome review -> operator-visible continuity guidance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_PILOT_STABILITY_REVIEW_AND_LONG_TERM_OUTCOME_REFINEMENT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_STABILITY_REVIEW_AND_LONG_TERM_OUTCOME_REFINEMENT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_STABILITY_RECHECK_AND_LONG_TERM_OUTCOME_REFINEMENT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup stability recheck

- continuity pilot review 现在会显式输出：
  - `stabilityRecheck.summary`
  - `stabilityRecheck.aggregateSummary`
  - `stabilityRecheck.highlights`
- cohort / failure class / threshold / session review 现在都会带：
  - `stabilityConfidenceBand`
  - `stabilityVarianceSummary`

### 3.2 Interval wording consistency

- `thresholdRevisions` 现在不只输出：
  - `confidenceInterval`
  - `bandAdjustmentRationale`
- 还会显式输出：
  - `intervalWordingSummary`
- step-level review 现在也会显式输出：
  - `intervalWordingSummary`
- session-level `pilotReview` 现在会带：
  - `intervalWordingSummary`
- canonical wording 现在统一收成：
  - `Wide confidence interval: advisory-only readout...`
  - `Guarded confidence interval: operator-visible readout...`
  - `Settled confidence interval: comparatively stable review readout...`

### 3.3 Long-term outcome review

- continuity pilot review 现在会显式输出：
  - `longTermOutcomeReview.summary`
  - `longTermOutcomeReview.aggregateSummary`
  - `longTermOutcomeReview.highlights`
- step-level review 现在会显式输出：
  - `materialImpactBand`
  - `materialImpactSummary`
- session-level `pilotReview` 现在会带：
  - `longTermMaterialImpactBand`
  - `longTermMaterialImpactSummary`

### 3.4 Operator insight surfaces

- meeting detail:
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 是 `UNSTABLE / WATCH / STABLE`
    - 当前 `stability confidence` 是 `HIGH / MEDIUM / LOW`
    - 当前 interval wording 为什么是 `WIDE / GUARDED / SETTLED`
    - 当前 long-term material impact 为什么是 `HIGH / WATCH / LOW`
- `/operating`:
  - `continuity-pilot-cases-card`
  - `continuity-cohort-breakdown-card`
  - `continuity-drift-card`
  - `continuity-threshold-revision-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显式显示：
    - `stability confidence`
    - `impact`

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase13`
  - `eval:helm-v2-2-continuity-pilot-stability-recheck-long-term-outcome-refinement`
- PR33 eval 会覆盖：
  - subgroup stability recheck
  - interval wording consistency
  - long-term outcome review
  - operator outcome variance synthesis
  - session-level PR33 review coverage
- e2e 会覆盖：
  - meeting detail 的 `stability confidence / interval wording / material impact` 文案
  - `/operating` 的 stability recheck、interval wording、long-term outcome review cards
  - continuity queue 的 `stability confidence / impact` meta

## 4. 已成形但仍需下一层

- current recheck 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- interval wording consistency 仍然是 anti-overclaim / operator-readability layer，不是正式统计区间系统
- long-term outcome review 仍然只表达 material correlation，不表达 SOP 因果已经成立
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

1. subgroup 越细，越容易让 stability recheck 受样本量限制
2. interval wording 如果脱离 canonical mapping，仍会重新产生 surface drift
3. long-term outcome review 如果表达不严谨，容易被误读成 SOP 已经证明因果有效

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
