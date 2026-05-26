---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Remediation Analytics And Operator Runbook Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow continuity remediation analytics / operator runbook slice

## 1. 主口径

这份 baseline 只冻结 continuity surface 的一层 next-layer truth：

`continuity recovery posture -> remediation trace accumulation -> analytics + repeat-pattern -> evidence surface -> bounded operator runbook`

它解决的是 continuity remediation explainability、repeat failure visibility 和 operator workflow clarity，不解决 execution authority 扩张。

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

## 3. 已经完整成立

### 3.1 Remediation analytics

- continuity surface 现在会显式输出：
  - `totalAttempts`
  - `appliedCount`
  - `reviewRequiredCount`
  - `blockedCount`
  - `latestAction`
  - `latestAttemptAt`
- analytics 直接挂到 meeting runtime continuity block，并下沉到 workspace continuity queue

### 3.2 Repeat-pattern detection

- continuity remediation 会把重复行为显式归类为：
  - `NONE`
  - `REPEATED_BLOCKED_ACTION`
  - `REPEATED_REVIEW_REQUIRED`
  - `REPEATED_REPRUNE_LOOP`
- 重复 blocked / review-required / reprune loop 不再被静默压平到“只是又试了一次”

### 3.3 Evidence surface

- continuity surface 现在会输出 operator-readable evidence summary：
  - review / blocked reasons
  - replay gaps
  - payload derivation
  - rollback anchor
  - evidence refs
  - latest remediation summary
- 目标是让 operator 能解释“为什么当前 posture 成立”，而不是直接读 raw JSON

### 3.4 Operator runbook

- continuity runbook 现在会给出 bounded guidance：
  - inspect evidence first
  - 什么时候 restore checkpoint
  - 什么时候 re-prune
  - 什么时候 save checkpoint
  - 遇到 repeat-pattern 时如何 stop retry / escalate
- runbook 只属于 operator workflow，不扩 send / execution / broad write authority

### 3.5 Surface coverage

- `features/meetings/meeting-v2-runtime-card.tsx`
  - 新增 remediation analytics
  - 新增 evidence surface
  - 新增 operator runbook
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - continuity summary 增加 review-required / repeat-pattern counts
  - continuity queue 增加 remediation attempt、repeat-pattern、evidence summary、runbook title

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase5`
  - `eval:helm-v2-2-continuity-remediation-analytics`
- repeat blocked / repeat review-required / repeat reprune loop / stable analytics 都进入 eval
- meeting detail 与 `/operating` continuity queue 都进入 e2e

## 4. 已成形但仍需下一层

- 当前 repeat-pattern detection 是 continuity-specific rule set，不是更广的 anomaly engine
- 当前 runbook 是 bounded diagnostic / remediation guide，不是自动恢复编排器
- 当前 analytics 仍聚焦 meeting-driven continuity loop，跨工作区和高并发群体模式仍需更多 pilot 证据

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

1. repeat-pattern 当前是规则检测，若 pilot 样本扩展后分布变化，仍需要再校准
2. evidence surface 目前是 operator-readable summary，不是完整历史回放界面
3. runbook 当前是 fixed guidance，不包含角色差异化 SOP 或交互式诊断树

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
