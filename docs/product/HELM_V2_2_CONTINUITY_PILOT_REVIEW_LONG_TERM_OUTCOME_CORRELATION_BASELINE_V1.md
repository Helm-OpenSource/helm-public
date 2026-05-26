---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Review And Long-term Outcome Correlation Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：PR31 continuity pilot review / long-term outcome correlation slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 pilot review truth：

`larger-sample review -> sample-aware recalibration -> long-term outcome correlation -> guidance refinement -> operator-visible continuity insights`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_CALIBRATION_DEEPENING_SOP_EFFECTIVENESS_SYNTHESIS_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_DEEPENING_SOP_EFFECTIVENESS_SYNTHESIS_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_REVIEW_LONG_TERM_OUTCOME_CORRELATION_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Larger-sample pilot review

- continuity pilot review 现在会显式输出：
  - `sampleReview.summary`
  - `sampleReview.aggregateSummary`
  - `sampleReview.cohortHighlights`
- cohort / threshold / step review 现在都会带：
  - `sampleCoverageBand`
  - `sampleCoverageSummary`

### 3.2 Sample-aware recalibration

- `thresholdRevisions` 现在不只输出：
  - `confidenceSummary`
  - `summary`
- 还会显式输出：
  - `sampleCoverageBand`
  - `sampleCoverageSummary`
- session-level `pilotReview` 现在会带：
  - `sampleCoverageBand`
  - `sampleCoverageSummary`
  - 更诚实的 `thresholdRevisionSummary`

### 3.3 Long-term outcome correlation

- continuity pilot review 现在会显式输出：
  - `longTermOutcomeCorrelation.summary`
  - `longTermOutcomeCorrelation.aggregateSummary`
  - `longTermOutcomeCorrelation.panels`
- step-level review 现在会显式输出：
  - `correlationBand`
  - `correlationSummary`
  - `recentEffectiveOutcomeRate`
  - `olderEffectiveOutcomeRate`
  - `longHorizonEffectiveOutcomeRate`
  - `outcomeDelta`
- session-level `pilotReview` 现在会带：
  - `outcomeCorrelationBand`
  - `longTermOutcomeSummary`

### 3.4 Guidance refinement

- continuity pilot review 现在会显式输出：
  - `guidanceRefinement.summary`
  - `guidanceRefinement.highlights`
- session-level `pilotReview` 现在会带：
  - `guidanceRefinementSummary`

### 3.5 Operator insight surfaces

- meeting detail:
  - `continuity-pilot-review` 现在能回答：
    - 当前 sample 是 `NARROW / QUALIFIED / BROAD`
    - 当前 long-term outcome 是 `AT_RISK / WATCH / STABLE`
    - 当前 subgroup calibration 为什么仍保守
    - 当前 guidance refinement 为什么要收紧或保持
- `/operating`:
  - `continuity-pilot-cases-card`
  - `continuity-cohort-breakdown-card`
  - `continuity-drift-card`
  - `continuity-threshold-revision-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显式显示：
    - `sample`
    - `correlation`

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase11`
  - `eval:helm-v2-2-continuity-pilot-review-long-term-outcome-correlation`
- PR31 eval 会覆盖：
  - larger-sample review
  - sample-aware recalibration
  - long-term outcome correlation
  - guidance refinement
  - session-level long-term review coverage
- e2e 会覆盖：
  - meeting detail 的 sample / outcome / refinement 文案
  - `/operating` 的 sample-backed review、long-term correlation、guidance refinement cards
  - continuity queue 的 `sample / correlation` meta

## 4. 已成形但仍需下一层

- current review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- sample-aware recalibration 仍然是规则化 operator guidance，不是统计学习模型
- long-term outcome correlation 仍然只表达相关性，不表达因果已经成立
- guidance refinement 仍然是 operator-facing runbook suggestion，不是 auto-remediation

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

1. larger-sample 仍然是 pilot review，不应写成 production truth
2. sampleCoverageBand 越细，越容易让 operator 误把 guidance 当成稳定统计结论
3. long-term outcome correlation 如果表达不严谨，容易被误读成因果性

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
