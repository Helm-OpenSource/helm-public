---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Calibration Review Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow continuity pilot calibration review slice

## 1. 主口径

这份 baseline 冻结的是 continuity surface 的下一层 calibration truth：

`pilot cohort breakdown -> threshold/confidence revision -> drift trend review -> SOP hit-rate / operator handling comparison`

它服务的是 operator 判断和 remediation review，不是执行权扩张，不是自动恢复编排，也不是更宽的 telemetry platform。

## 2. 当前 truth source

继承：

- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
- `HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`
- `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REMEDIATION_EFFECTIVENESS_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REVIEW_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Pilot cohort 分层统计增强

- continuity pilot review 现在不只输出 failure class 分布
- 它还会输出：
  - `workspaceCohort`
  - `meetingShapeCohorts`
  - `remediationOutcomeReview`
- 当前 cohort 维度保持窄实现：
  - workspace size band
  - meeting shape
  - failure pattern
  - remediation outcome

### 3.2 Threshold / confidence 再校准

- continuity pilot review 现在会显式输出 `thresholdRevisions`
- session-level `pilotReview` 现在会同时带出：
  - `workspaceSizeBand`
  - `meetingShape`
  - `cohortSummary`
  - `thresholdRevisionSummary`
- `/operating` 和 meeting detail 现在都能回答：
  - 当前 session 落在哪个 pilot cohort
  - 这个 cohort / failure class 的 threshold 是否需要更早收紧

### 3.3 Drift 趋势复核

- pilot drift 现在不只看总 drift rate
- 还会额外暴露：
  - `recentDriftRate`
  - `olderDriftRate`
  - `driftRateDelta`
  - `recentRepeatIneffectiveRate`
  - `effectivenessChange`
- 这层趋势只基于当前 repo 内 pilot sample 的 newer/older window，对 operator 可解释，但不夸成生产遥测系统

### 3.4 SOP 命中率与 operator handling 对照

- continuity pilot review 现在新增 `operatorHandlingEffectiveness`
- 它会显式输出：
  - `matchedGuidanceRate`
  - `skippedGuidanceRate`
  - `ineffectiveAfterGuidanceRate`
  - `reviewEscalationRate`
  - summary + highlights
- continuity queue item 也新增：
  - `meetingShape`
  - `guidanceStatus`
  - `guidanceSummary`

### 3.5 Surface coverage

- meeting detail:
  - `continuity-pilot-review` 现在会显示 workspace size band、meeting shape、cohort summary、threshold revision、operator handling summary
- `/operating`:
  - `continuity-cohort-breakdown-card`
  - `continuity-threshold-revision-card`
  - `continuity-operator-handling-card`
  - continuity queue meta 现在会显示 `shape` 与 `guidance`

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase8`
  - `eval:helm-v2-2-continuity-pilot-calibration-review`
- PR28 eval 会覆盖：
  - cohort review
  - threshold revision review
  - drift trend review
  - operator handling effectiveness review
  - session-level cohort review
- e2e 会覆盖：
  - meeting detail 的 cohort / guidance 文案
  - `/operating` 的 cohort / threshold / operator handling cards
  - continuity queue 的 `shape / guidance` meta

## 4. 已成形但仍需下一层

- cohort / drift review 仍然只基于 repo-internal pilot sample，不是 production telemetry analytics
- operator handling effectiveness 仍然是规则化 review，不是基于完整 clickstream 的行为分析
- threshold revision 仍然是 pilot-backed operator suggestion，不是自动收紧策略

## 5. 刻意未做

- auto-remediation orchestrator
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- route/query rewrite

## 6. 风险项

1. current pilot sample 仍偏窄，workspace size band 和 meeting shape 的阈值后续还需要更多真实 pilot 校准
2. operator handling summary 目前是解释性规则，不是完整行为统计；它回答的是“是否大致按 guidance 处理”，不是“为什么每一步被点击”
3. drift review 采用 newer/older window，适合当前 narrow slice，但后续如果进入更长时间跨度，需要更系统的时间序列口径

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
