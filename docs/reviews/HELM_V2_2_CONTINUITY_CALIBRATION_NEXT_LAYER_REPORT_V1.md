---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Calibration Next Layer Report v1

更新时间：2026-04-04  
状态：Implemented  
适用范围：PR29 continuity calibration next-layer review slice

## 1. 本轮目标

PR29 继续只在 continuity surface 与 operator workflow 内推进：

- expanded pilot cohort review
- threshold / confidence recalibration
- longer-horizon drift comparison
- SOP hit-rate vs final operator outcome variance
- eval / e2e / docs / guard 收口

本轮不进入 auto-remediation orchestration，不扩 execution authority，也不把 continuity review 写成更宽的 telemetry platform。

## 2. 本轮落地内容

### 2.1 Runtime continuity review

- `lib/helm-v2/runtime-upgrade.ts`
  - continuity pilot review 新增：
    - `cohortFamilies`
    - `calibrationProfile.riskBandSummary`
    - `calibrationProfile.revisedHighlights`
    - `drift.middleDriftRate`
    - `drift.oldestDriftRate`
    - `drift.longHorizonDriftRate`
    - `drift.longHorizonRepeatIneffectiveRate`
    - `drift.longHorizonEffectivenessRate`
    - `drift.materiallyDriftingCohorts`
    - `operatorHandlingEffectiveness.outcomeVarianceSummary`
    - `operatorHandlingEffectiveness.stepReviews`
  - session-level `pilotReview` 新增：
    - `riskBand`
    - `longHorizonSummary`
    - `varianceSummary`
  - continuity queue 新增：
    - `pilotRiskBand`
    - 更完整的 `pilotReviewSummary`

### 2.2 Surface update

- `features/meetings/meeting-v2-runtime-card.tsx`
  - `continuity-pilot-review` 现在同时显示 risk band、long-horizon review、operator variance
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - continuity pilot cards 现在会同时显示：
    - cohort family risk / threshold
    - long-horizon drift
    - materially drifting cohorts
    - operator outcome variance
    - SOP step-level review
  - continuity queue meta 新增 `pilot risk`

### 2.3 Eval / tests / e2e

- `lib/helm-v2/runtime-upgrade.test.ts`
  - 新增 PR29 risk band / long-horizon / variance 断言
- `lib/helm-v2/eval-harness.ts`
  - 新增 `runHelmV22ContinuityCalibrationNextLayerEvalHarness()`
- `lib/helm-v2/eval-harness.test.ts`
  - 新增 PR29 harness coverage
- 新增：
  - `evals/helm-v2/continuity-calibration-next-layer-v2_2-golden-samples.json`
  - `scripts/helm-v2-2-continuity-calibration-next-layer-evals.ts`
- `tests/e2e/continuity-remediation-analytics.spec.ts`
  - 新增 risk / long-horizon / variance / pilot risk meta 断言

### 2.4 Docs / guard

- 新增：
  - `docs/product/HELM_V2_2_CONTINUITY_CALIBRATION_NEXT_LAYER_BASELINE_V1.md`
  - `docs/reviews/HELM_V2_2_CONTINUITY_CALIBRATION_NEXT_LAYER_REPORT_V1.md`
- 更新：
  - `README.md`
  - `docs/README.md`
  - `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`
  - `PLANS.md`

## 3. 本轮未做

本轮明确没有进入：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- route/query rewrite

## 4. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no route/query rewrite

## 5. 验证

本轮实际通过：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run eval:helm-v2-2-phase9`
- `npm run test -- lib/helm-v2/runtime-upgrade.test.ts lib/helm-v2/eval-harness.test.ts`
- `npm run build`
- `npm run test`
- `npm run e2e`
- `npm run quality:regression`
- `npm run db:reset`

## 6. 当前结论

PR29 已把 continuity calibration review 从“看见 cohort / threshold / drift delta / handling posture”推进到“看见 cohort family、risk band、long-horizon drift，以及 SOP step-level outcome variance”。  
它仍然只是一层 continuity operator calibration review，不是自动恢复系统，也不是执行权限扩张。
