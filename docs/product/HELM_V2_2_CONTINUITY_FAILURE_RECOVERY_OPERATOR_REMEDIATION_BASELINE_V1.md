---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Failure Recovery And Operator Remediation Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow continuity recovery slice

## 1. 主口径

这份 baseline 只冻结 continuity surface 的一层 next-layer truth：

`continuity failure posture -> bounded operator remediation -> remediation trace + rollback anchor`

它解决的是 continuity recovery correctness 和 operator remediation legibility，不解决 execution authority 扩张。

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

## 3. 已经完整成立

### 3.1 Continuity failure taxonomy

- continuity surface 现在会把 failure posture 收敛成：
  - `NONE`
  - `NO_RECOVERY_ANCHOR`
  - `BUDGET_PRESSURE`
  - `PAYLOAD_STATE_DRIFT`
  - `REPLAY_DRIFT`
  - `PROTECTED_STATE_GAP`
- taxonomy 直接挂到 meeting runtime、session trace 和 workspace continuity queue

### 3.2 Recovery state model

- continuity recovery state 已明确为：
  - `STABLE`
  - `RECOVERABLE`
  - `REVIEW_REQUIRED`
  - `BLOCKED`
- current state 由 replay fidelity、payload source posture、budget posture、checkpoint anchor 和 protected continuity field 缺失一起决定

### 3.3 Bounded operator remediation

- continuity surface 只允许三个 bounded remediation action：
  - `SAVE_RECOVERY_CHECKPOINT`
  - `RESUME_CHECKPOINT`
  - `REPRUNE_CONTEXT`
- `REVIEW_REQUIRED` 与 `BLOCKED` posture 不会静默执行 remediation
- remediation authority 仍然局限在 continuity surface 内，不扩大 execution authority

### 3.4 Remediation trace + rollback anchor

- 每次 remediation attempt 都会写出：
  - before summary
  - after summary
  - execution status
  - rollback anchor
- 对非保存 checkpoint 的变更动作，会先落一个 operator pre-action rollback anchor

### 3.5 Eval / e2e gate

- v2.2 continuity recovery eval harness 已落地
- 新增脚本入口：
  - `eval:helm-v2-2-phase4`
  - `eval:helm-v2-2-continuity-recovery`
- recoverable / review-required / blocked 三条路径都有 e2e 覆盖

## 4. 已成形但仍需下一层

- 当前 remediation 仍是 bounded operator action，不是自动恢复编排
- 当前 rollback anchor 以 checkpoint 为核心，不是完整 event-sourcing rollback
- 当前主要覆盖 meeting-driven continuity loop，跨工作区和高并发场景仍需更多 pilot 证据

## 5. 刻意未做

- full continuity auto-recovery orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

## 6. 风险项

1. rollback anchor 当前依赖 checkpoint substrate，若上游 checkpoint 质量偏弱，恢复结果仍需人工确认
2. `REVIEW_REQUIRED` posture 当前是保守策略，可能在边界场景偏向拦截而不是继续自动恢复
3. remediation trace 当前记录的是 current-state before / after，不是完整历史回放系统

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
