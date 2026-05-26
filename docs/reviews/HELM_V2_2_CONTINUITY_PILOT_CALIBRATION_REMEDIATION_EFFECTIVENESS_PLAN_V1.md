---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Pilot Calibration And Remediation Effectiveness Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR26 continuity pilot calibration / remediation effectiveness narrow slice

## 1. freeze truth 起点

本轮继承以下已冻结 continuity 口径，不重写前序基线：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_OBSERVABILITY_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_REPORT_V1.md`

## 2. PR26 要证明什么

PR26 只证明 continuity recovery surface 已经从“能恢复、能解释”进入“状态更准、动作效果可评估、低效恢复会被识别并收紧”：

1. recovery state 的判断有 pilot-backed calibration，不再只靠单次 posture 快照
2. bounded remediation action 会被评估为有效、部分有效、无效或无信号
3. repeated ineffective recovery 会显式升级成 operator-visible posture，而不是继续重试
4. evidence surface 与 runbook 会把 calibration 和 effectiveness 一起讲清楚
5. eval 与 e2e 会验证 recoverable / review-required / blocked 路径下的恢复效果，而不扩 execution authority

## 3. exact operator workflow

`meeting-driven runtime session -> continuity posture + recovery state -> pilot-backed calibration -> bounded remediation trace -> effectiveness classification -> repeat ineffective detection -> evidence surface + runbook`

## 4. preserved boundaries

边界保持不变：

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

## 5. phase plan

### Phase 1

- 增加 recovery calibration：
  - pilot profile
  - calibrated recovery summary
  - state accuracy / confidence explanation

### Phase 2

- 增加 remediation effectiveness：
  - effective / partial / ineffective / no_signal
  - repeated ineffective detection
  - ineffective loop 的 bounded escalation guidance

### Phase 3

- 同步 operator surface：
  - meeting runtime card 显示 calibration + effectiveness
  - operator queue 显示 repeated ineffective / recovery accuracy posture
  - runbook 根据 effectiveness 与 repeat pattern 调整建议

### Phase 4

- 新增或更新 eval fixtures / harness / tests / e2e
- baseline / acceptance report / docs index / self-check / boundary guard 同步

## 6. eval contract

最少覆盖：

1. pilot-backed calibration 会修正 recovery state 的边界 case，而不是只复读静态 posture
2. remediation action 会输出 effectiveness 结果，并在 evidence surface 可见
3. repeated ineffective recovery 会升级为 operator-visible posture，不允许静默重试
4. effective recovery 会保留 bounded remediation 边界，不把结果写成 execution authority
5. operator panel 与 meeting card 对同一 session 的 calibration / effectiveness 不得冲突
6. runbook wording 不得越过 judgement-first / no auto-send / no broad auto-write 边界

## 7. explicitly deferred

本轮明确不做：

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine
