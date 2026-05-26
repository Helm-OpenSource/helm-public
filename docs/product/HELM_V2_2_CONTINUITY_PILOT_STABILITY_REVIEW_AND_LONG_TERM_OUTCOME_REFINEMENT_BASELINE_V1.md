---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Stability Review And Long-term Outcome Refinement Baseline v1

更新时间：2026-04-05  
状态：Baseline  
适用范围：PR32 continuity pilot stability / long-term outcome refinement slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 stability truth：

`larger pilot sample -> subgroup stability review -> confidence interval simplification -> long-term SOP impact refinement -> operator-visible guidance analysis`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_PILOT_REVIEW_LONG_TERM_OUTCOME_CORRELATION_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_REVIEW_LONG_TERM_OUTCOME_CORRELATION_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_STABILITY_REVIEW_AND_LONG_TERM_OUTCOME_REFINEMENT_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Subgroup stability review

- continuity pilot review 现在会显式输出：
  - `stabilityReview.summary`
  - `stabilityReview.aggregateSummary`
  - `stabilityReview.subgroupHighlights`
- cohort / failure class / remediation posture 现在会显式带：
  - `stabilityBand`
  - `stabilitySummary`

### 3.2 Confidence interval simplification

- `thresholdRevisions` 现在不只输出：
  - `confidenceSummary`
  - `summary`
- 还会显式输出：
  - `confidenceInterval`
  - `bandAdjustmentRationale`
  - `stabilityBand`
- session-level `pilotReview` 现在会带：
  - `confidenceInterval`
  - `confidenceAdjustmentRationale`

### 3.3 Long-term SOP impact refinement

- continuity pilot review 现在会显式输出：
  - `longTermSopImpact.summary`
  - `longTermSopImpact.aggregateSummary`
  - `longTermSopImpact.highlights`
- step-level review 现在会显式输出：
  - `stabilityBand`
  - `confidenceInterval`
  - `bandAdjustmentRationale`
  - `longTermImpactSummary`
- session-level `pilotReview` 现在会带：
  - `longTermSopImpactSummary`

### 3.4 Operator insight surfaces

- meeting detail:
  - `continuity-pilot-review` 现在能回答：
    - 当前 subgroup 是 `UNSTABLE / WATCH / STABLE`
    - 当前 confidence interval 是 `WIDE / GUARDED / SETTLED`
    - 当前 long-term SOP impact 为什么仍 at-risk 或相对更稳
- `/operating`:
  - `continuity-pilot-cases-card`
  - `continuity-cohort-breakdown-card`
  - `continuity-drift-card`
  - `continuity-threshold-revision-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显式显示：
    - `stability`
    - `interval`
    - `correlation`

### 3.5 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase12`
  - `eval:helm-v2-2-continuity-pilot-stability-review-long-term-outcome-refinement`
- PR32 eval 会覆盖：
  - subgroup stability review
  - confidence interval simplification
  - long-term SOP impact refinement
  - operator guidance analysis
  - session-level PR32 review coverage
- e2e 会覆盖：
  - meeting detail 的 stability / interval / long-term SOP 文案
  - `/operating` 的 stability review、interval review、long-term SOP impact cards
  - continuity queue 的 `stability / interval / correlation` meta

## 4. 已成形但仍需下一层

- current stability review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- confidence interval simplification 仍然是 operator-visible anti-overclaim layer，不是正式统计置信区间
- long-term SOP impact 仍然只表达长期相关性与稳定性，不表达因果已经成立
- guidance analysis 仍然是 operator-facing runbook suggestion，不是 auto-remediation

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

1. subgroup 越细，越容易让稳定性读数受样本量限制
2. confidence interval 如果表达不严谨，容易被误读成正式统计区间
3. long-term SOP impact 如果表达不严谨，容易被误读成 SOP 已证明具备因果性

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
