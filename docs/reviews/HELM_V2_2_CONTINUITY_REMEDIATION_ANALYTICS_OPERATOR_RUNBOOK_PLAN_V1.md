---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Remediation Analytics And Operator Runbook Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR25 continuity remediation analytics / operator runbook narrow slice

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

## 2. PR25 要证明什么

PR25 只证明 continuity recovery surface 已经从“可恢复”进入“可分析、可解释、可执行受限 runbook”：

1. remediation analytics 可见，并能解释尝试次数、结果分布、最新状态
2. evidence surface 可读，能够解释为什么当前进入 recoverable / review-required / blocked
3. repeat-pattern 会显式暴露，不会静默覆盖重复失败或重复 reprune
4. operator runbook 只提供 continuity remediation guidance，不扩执行权
5. analytics / runbook / evidence / repeat-pattern 路径都进入 eval 与 e2e

## 3. exact operator workflow

`meeting-driven runtime session -> continuity posture + recovery state -> remediation trace accumulation -> analytics + repeat-pattern -> evidence surface -> bounded operator runbook -> optional bounded remediation`

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

- 从 remediation trace 派生 analytics：
  - total attempts
  - applied / review-required / blocked counts
  - latest attempt
  - repeat-pattern summary

### Phase 2

- 增加 evidence surface：
  - recovery reasons
  - replay / payload / rollback evidence
  - remediation before / after summary

### Phase 3

- 增加 operator runbook：
  - 当前 recovery state 的推荐排查顺序
  - repeat-pattern 下的 bounded remediation guidance
  - meeting runtime card 与 operator panel 同步可读 posture

### Phase 4

- 新增或更新 eval fixtures / harness / tests / e2e
- baseline / acceptance report / docs index / self-check / boundary guard 同步

## 6. eval contract

最少覆盖：

1. recoverable path 会显示 remediation analytics 和 evidence summary
2. review-required path 会显示 runbook，但不会写成 execution authority
3. blocked path 会显示 repeat-pattern 或 blocker evidence，而不是静默吞没
4. repeat blocked / repeat review-required / repeat reprune 会产生可见 pattern
5. operator panel 与 meeting card 对同一 session 的 analytics / repeat-pattern 不得冲突
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
