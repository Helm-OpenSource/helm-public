---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Pilot Calibration And Remediation Effectiveness Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow continuity pilot calibration / remediation effectiveness slice

## 1. 主口径

这份 baseline 只冻结 continuity surface 的下一层 truth：

`continuity recovery posture -> pilot-backed calibration -> remediation effectiveness -> repeat ineffective detection -> operator-visible evidence + runbook`

它解决的是 recovery state 准确性、bounded remediation action 的有效性判断，以及低效恢复循环的显式收紧；它不扩 execution authority。

## 2. 当前 truth source

继承：

- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_OBSERVABILITY_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_REPORT_V1.md`

## 3. 已经完整成立

### 3.1 Pilot-backed recovery calibration

- continuity surface 现在同时保留 raw recovery posture 和 calibrated recovery posture
- calibration 会显式吸收以下 signal：
  - `riskLevel`
  - `replayStatus`
  - `payloadStateSource`
  - `failureTaxonomy`
  - repeat-pattern
  - latest remediation effectiveness
- calibration 会输出：
  - `rawState`
  - `calibratedState`
  - `confidence`
  - operator-readable reason summary

### 3.2 Remediation effectiveness

- bounded remediation trace 现在会被分类为：
  - `EFFECTIVE`
  - `PARTIAL`
  - `INEFFECTIVE`
  - `NO_SIGNAL`
- latest effectiveness 会进入 meeting detail continuity block 和 workspace continuity queue
- repeated ineffective recovery 不再只表现为“又做了一次动作”

### 3.3 Repeated ineffective detection

- continuity analytics 现在额外识别：
  - `REPEATED_INEFFECTIVE_ACTION`
- 当 reprune / restore / checkpoint 等 bounded remediation 持续无效时，calibration 会把 posture 收紧到更保守的 recovery state，而不是继续 blind retry

### 3.4 Evidence surface and runbook integration

- evidence surface 现在会把以下内容一起讲清楚：
  - calibration 为什么收紧或维持
  - latest effectiveness 是什么
  - repeat ineffective 是否成立
  - rollback anchor 是否可用
- runbook 会根据 effectiveness posture 改写建议：
  - ineffective loop 优先升级 review，而不是继续重试
  - no-signal loop 优先补 anchor / evidence，而不是宣称已恢复

### 3.5 Surface coverage

- `features/meetings/meeting-v2-runtime-card.tsx`
  - 新增 calibration block
  - 新增 remediation effectiveness block
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - continuity summary 增加 low-confidence / ineffective counts
  - continuity queue 增加 calibration confidence / latest effectiveness / repeat ineffective 摘要

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase6`
  - `eval:helm-v2-2-continuity-pilot-calibration`
- pilot fixture 会覆盖：
  - effective recovery
  - partial recovery
  - ineffective reprune loop
  - review-required no-signal loop
- e2e 会验证：
  - effective path 保持 `STABLE -> STABLE`
  - ineffective reprune loop 保持 `REVIEW_REQUIRED -> REVIEW_REQUIRED · LOW`，并显式阻止 blind retry

## 4. 已成形但仍需下一层

- calibration 目前仍是 pilot-backed rule profile，不是统计学习或大样本阈值系统
- effectiveness 目前只评估 continuity-bounded remediation，不是更宽的 operator effectiveness engine
- repeated ineffective detection 仍聚焦 meeting-driven continuity loop，不是跨 domain 的 anomaly layer

## 5. 刻意未做

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

## 6. 风险项

1. calibration 当前仍依赖 repo 内 pilot fixture 与规则口径，真实 pilot 样本扩充后仍需要再校准
2. partial 与 ineffective 的边界目前偏保守，可能会把“刚开始改善”的链路先降到 review posture
3. evidence surface 仍是 operator-readable summary，不是完整历史回放

## 7. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no shell thinning
- no route/query rewrite
