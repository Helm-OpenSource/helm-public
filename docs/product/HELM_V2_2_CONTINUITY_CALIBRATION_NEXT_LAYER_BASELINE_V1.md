---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration Next Layer Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：PR29 continuity calibration next-layer review slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 calibration truth：

`expanded cohort families -> recalibrated threshold/confidence -> longer-horizon drift review -> SOP hit-rate / operator outcome variance`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REVIEW_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REVIEW_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_NEXT_LAYER_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Expanded cohort families

- continuity pilot review 现在不仅按 workspace size、meeting shape、failure pattern、remediation posture 做第一层 cohort
- 还会显式输出更细的 `cohortFamilies`
- 每个 family 都会带出：
  - `riskBand`
  - `recommendedIneffectiveThreshold`
  - `recalibrationSummary`
  - `longHorizonSummary`

### 3.2 Recalibrated threshold / confidence

- continuity pilot review 现在会额外输出：
  - `riskBandSummary`
  - `revisedHighlights`
  - `thresholdRevisions[].confidenceSummary`
- session-level `pilotReview` 现在会显式带出：
  - `riskBand`
  - `thresholdRevisionSummary`
  - `adjustmentSummary`

### 3.3 Longer-horizon drift review

- continuity pilot review 现在不只回答 recent / older drift
- 还会显式暴露：
  - `middleDriftRate`
  - `oldestDriftRate`
  - `longHorizonDriftRate`
  - `longHorizonRepeatIneffectiveRate`
  - `longHorizonEffectivenessRate`
  - `materiallyDriftingCohorts`
- session-level `pilotReview` 也会带出 `longHorizonSummary`

### 3.4 SOP hit-rate / outcome variance review

- operator handling 现在不只输出 aggregate hit/skip/effective posture
- 还会显式输出：
  - `outcomeVarianceSummary`
  - `stepReviews`
- `stepReviews` 会按 failure-class 对应的 SOP step 聚合：
  - `matchedGuidanceRate`
  - `skippedGuidanceRate`
  - `ineffectiveAfterHitRate`
  - `improvementHint`
- session-level `pilotReview` 现在会带出 `varianceSummary`

### 3.5 Surface coverage

- meeting detail:
  - `continuity-pilot-review` 现在能回答 risk band、long-horizon drift、operator variance
- `/operating`:
  - `continuity-cohort-breakdown-card`
  - `continuity-drift-card`
  - `continuity-threshold-revision-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显式显示 `pilot risk`

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase9`
  - `eval:helm-v2-2-continuity-calibration-next-layer`
- PR29 eval 会覆盖：
  - expanded cohort family review
  - threshold / confidence recalibration review
  - longer-horizon drift review
  - SOP variance review
  - session-level next-layer calibration review
- e2e 会覆盖：
  - meeting detail 的 risk / long-horizon / variance 文案
  - `/operating` 的 cohort / drift / operator handling card
  - continuity queue 的 `pilot risk` meta

## 4. 已成形但仍需下一层

- current review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- threshold / confidence 仍然是规则化 recalibration，不是统计学习模型
- SOP variance 仍然是 operator-facing guidance review，不是 clickstream / behavior mining

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

1. 更细 cohort family 仍然可能受样本量约束，不能把当前结果写成生产统计 truth
2. long-horizon drift 仍然是当前 narrow slice 的 review 口径，不是更宽的长期趋势平台
3. SOP variance summary 偏保守，部分“刚开始改善”的 case 仍会先被压到 review-first posture

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
