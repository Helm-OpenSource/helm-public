---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration Deepening / SOP Effectiveness Synthesis Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：PR30 continuity calibration deepening / operator insight slice

## 1. 主口径

这份 baseline 冻结的是 continuity operator workflow 的下一层 calibration truth：

`finer subgroup review -> second-pass threshold/confidence refinement -> drift synthesis -> SOP effectiveness synthesis -> operator-facing continuity insights`

它服务的是 operator diagnosis、review posture 和 runbook refinement，不是自动恢复编排，不是 execution-authority expansion，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_2_CONTINUITY_CALIBRATION_NEXT_LAYER_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_NEXT_LAYER_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_DEEPENING_SOP_EFFECTIVENESS_SYNTHESIS_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Finer subgroup calibration

- continuity pilot review 现在不只看 `cohortFamilies`
- 还会进一步显式输出：
  - `sessionDensityCohorts`
  - `meetingFrequencyCohorts`
  - `failureHistoryCohorts`
  - `participantRoleCohorts`
- session-level `pilotReview` 现在也会带出：
  - `sessionDensityBand`
  - `meetingFrequencyBand`
  - `failureHistoryBand`
  - `participantRolePosture`
  - `subgroupSummary`

### 3.2 Second-pass threshold / confidence refinement

- workspace-level continuity pilot review 现在会额外输出：
  - `subgroupCalibration.summary`
  - `subgroupCalibration.cohortHighlights`
  - 按 subgroup 收紧后的 `thresholdRevisions`
- session-level `pilotReview` 现在会显式带出：
  - `refinedCalibrationSummary`
  - subgroup-specific `thresholdRevisionSummary`
  - subgroup-specific `adjustmentSummary`

### 3.3 Drift synthesis

- continuity pilot review 现在不只暴露 long-horizon drift 指标
- 还会显式输出：
  - `driftSynthesis.summary`
  - `driftSynthesis.panels`
  - subgroup 视角的 drift 集中区与 trend 对照
- session-level `pilotReview` 现在会带出 `driftSynthesisSummary`

### 3.4 SOP effectiveness synthesis

- continuity pilot review 现在不只暴露 step-level variance
- 还会显式输出：
  - `sopEffectivenessSynthesis.summary`
  - `sopEffectivenessSynthesis.aggregateSummary`
  - `sopEffectivenessSynthesis.highlights`
- session-level `pilotReview` 现在会带出 `sopEffectivenessSummary`

### 3.5 Operator insight surfaces

- meeting detail:
  - `continuity-pilot-review` 现在能回答：
    - session density
    - meeting cadence
    - failure history
    - participants
    - subgroup calibration
    - drift synthesis
    - SOP effectiveness
- `/operating`:
  - `continuity-cohort-breakdown-card`
  - `continuity-drift-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显式显示：
    - `density`
    - `cadence`
    - `history`
    - `participants`

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase10`
  - `eval:helm-v2-2-continuity-calibration-deepening-sop-effectiveness-synthesis`
- PR30 eval 会覆盖：
  - fine-grained subgroup calibration review
  - subgroup threshold / confidence refinement
  - drift synthesis review
  - SOP effectiveness synthesis review
  - session-level operator insight coverage
- e2e 会覆盖：
  - meeting detail 的 subgroup / drift / SOP 文案
  - `/operating` 的 subgroup calibration / drift synthesis / SOP effectiveness cards
  - continuity queue 的 density / cadence / history / participants meta

## 4. 已成形但仍需下一层

- current review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- subgroup calibration 仍然是规则化 refinement，不是统计学习模型
- participant role posture 仍然只来自当前可见 metadata，不是更宽的 org graph 或行为画像
- SOP effectiveness synthesis 仍然是 operator-facing guidance review，不是 clickstream / behavior mining

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

1. subgroup 切分更细后，仍然可能受样本量约束，不能把当前结果写成生产统计 truth
2. meeting cadence / participant posture 的读法仍依赖当前 metadata 完整度，metadata 缺口会降低 subgroup 解释力
3. SOP effectiveness summary 偏保守，部分“刚开始改善”的 case 仍可能先被压到 review-first posture

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
