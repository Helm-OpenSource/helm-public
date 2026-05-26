---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Observability Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow next-layer slice

## 1. 主口径

这份 baseline 只冻结 v2.2 的一个 next-layer truth：

`budgeted session continuity posture -> operator-readable continuity risk posture`

它解决的是 continuity 可观测性和可解释性，不解决执行权扩张。

## 2. 当前 truth source

继承：

- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
- `HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`
- `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `HELM_V2_2_COORDINATION_TRACE_BASELINE_V1.md`

## 3. 已经完整成立

### 3.1 Continuity risk runtime helper

- 已新增 continuity risk helper：`LOW / WATCH / HIGH`
- 当前分级规则：
  - replay fidelity `WEAK` -> `HIGH`
  - budget-sensitive 或 prune trace posture -> `WATCH`
  - 其余稳定态 -> `LOW`
- 每一级都有短摘要和 operator action guidance

### 3.2 Workspace continuity operator readability

- workspace runtime operator overview 新增 continuity 指标：
  - `weakReplaySessions`
  - `highRiskContinuitySessions`
  - `checkpointDerivedContinuitySessions`
- continuity queue 新增：
  - `riskLevel`
  - `riskSummary`
  - `replayStatus`
  - `payloadStateSource`
- operator 可以在一个队列里看到 continuity posture 与建议动作，不需要先翻 raw trace

### 3.3 Eval / test gate

- 新增 v2.2 continuity observability eval harness
- 新增脚本入口：
  - `eval:helm-v2-2-phase2`
  - `eval:helm-v2-2-continuity-observability`
- harness 和 test 同步验证 high/watch/low 三种风险姿态以及 action guidance

## 4. 已成形但仍需下一层

- 当前 risk model 是窄规则引擎，不是统计学习或长期 drift 检测
- 当前主要覆盖 meeting-driven continuity loop，真实高并发多租户长时场景仍需 pilot 证据
- 当前 action guidance 是短文本建议，还不是自动化恢复流程

## 5. 刻意未做

- full continuity auto-recovery orchestration
- full compaction engine
- dreaming consolidator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- platform expansion

## 6. 风险项

1. `WATCH` posture 是保守策略，可能在边界场景产生“可接受的偏高提醒”
2. 当前风险模型依赖 runtime state 完整性，若上游 trace 缺字段会影响判读质量
3. 目前没有跨天趋势评分，长周期风险需要后续层补充

## 7. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite
