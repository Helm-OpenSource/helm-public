---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Pilot Review And Long-term Outcome Correlation Report v1

更新时间：2026-04-04  
状态：Implemented  
适用范围：PR31 continuity pilot review / long-term outcome correlation slice

## 1. 本轮目标

PR31 继续只在 continuity surface 与 operator workflow 内推进：

- larger-sample pilot review
- sample-aware threshold / confidence recalibration
- long-term outcome correlation
- guidance refinement
- operator-facing insight surface
- eval / e2e / docs / guard 收口

本轮不进入 auto-remediation orchestration，不扩 execution authority，也不把 continuity review 写成更宽的 telemetry platform。

## 2. 本轮落地内容

### 2.1 Runtime continuity review

- `lib/helm-v2/runtime-upgrade.ts`
  - continuity pilot review 新增：
    - `sampleReview`
    - `longTermOutcomeCorrelation`
    - `guidanceRefinement`
  - cohort / threshold / step review 新增：
    - `sampleCoverageBand`
    - `sampleCoverageSummary`
  - step review 新增：
    - `correlationBand`
    - `correlationSummary`
    - `recentEffectiveOutcomeRate`
    - `olderEffectiveOutcomeRate`
    - `longHorizonEffectiveOutcomeRate`
    - `outcomeDelta`
  - session-level `pilotReview` 新增：
    - `sampleCoverageBand`
    - `sampleCoverageSummary`
    - `outcomeCorrelationBand`
    - `longTermOutcomeSummary`
    - `guidanceRefinementSummary`
  - continuity queue 新增：
    - `pilotSampleCoverageBand`
    - `pilotOutcomeCorrelationBand`

### 2.2 Surface update

- `features/meetings/meeting-v2-runtime-card.tsx`
  - `continuity-pilot-review` 现在同时显示：
    - sample band
    - outcome correlation band
    - sample coverage summary
    - long-term outcome summary
    - guidance refinement summary
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - continuity pilot cards 现在会同时显示：
    - sample review summary / aggregate
    - cohort-level sample coverage
    - long-term outcome correlation summary / panels
    - guidance refinement summary / highlights
  - continuity queue meta 新增：
    - `sample`
    - `correlation`

### 2.3 Eval / tests / e2e

- `lib/helm-v2/runtime-upgrade.test.ts`
  - 补充 PR31 sample / correlation / guidance refinement 断言
- `lib/helm-v2/eval-harness.ts`
  - 新增 `runHelmV22ContinuityPilotReviewLongTermOutcomeCorrelationEvalHarness()`
- `lib/helm-v2/eval-harness.test.ts`
  - 新增 PR31 harness coverage
- 新增：
  - `evals/helm-v2/continuity-pilot-review-long-term-outcome-correlation-v2_2-golden-samples.json`
  - `scripts/helm-v2-2-continuity-pilot-review-long-term-outcome-correlation-evals.ts`
- `tests/e2e/continuity-remediation-analytics.spec.ts`
  - 新增 sample / outcome / guidance refinement operator insight 断言
- 同时修正一条既有 eval fixture：
  - `evals/helm-v2/continuity-calibration-next-layer-v2_2-golden-samples.json`
  - 原因是 PR31 将 step improvement hint 从 “更显式” 收紧成 “tighten evidence collection”，需要同步 truthful fixture

### 2.4 Docs / guard

- 新增：
  - `docs/product/HELM_V2_2_CONTINUITY_PILOT_REVIEW_LONG_TERM_OUTCOME_CORRELATION_BASELINE_V1.md`
  - `docs/reviews/HELM_V2_2_CONTINUITY_PILOT_REVIEW_LONG_TERM_OUTCOME_CORRELATION_REPORT_V1.md`
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
- `npm run eval:helm-v2-2-phase11`
- `npm run test -- lib/helm-v2/runtime-upgrade.test.ts lib/helm-v2/eval-harness.test.ts`
- `npm run build`
- `npm run test`
- `npm run e2e`
- `npm run quality:regression`
- `npm run db:reset`

## 6. 当前结论

PR31 已把 continuity pilot review 从“看 finer subgroup、drift synthesis、SOP effectiveness synthesis”推进到“看 larger-sample sample coverage、sample-aware recalibration、long-term outcome correlation 与 guidance refinement”。  
它仍然只是一层 continuity operator review，不是自动恢复系统，也不是执行权限扩张。
