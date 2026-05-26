---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Effectiveness Review Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：Helm v2.2 narrow continuity pilot effectiveness review slice

## 1. 主口径

这份 baseline 冻结的是 continuity surface 的下一层 operator truth：

`pilot case distribution -> calibration profile review -> remediation outcome drift -> refined SOP guidance`

它解决的是 pilot-backed usefulness review，而不是权限扩张。continuity surface 现在不仅能显示单 session posture，还能把 pilot 中最常见的 failure class、threshold 建议、drift 情况和 SOP 收成同一条 operator workflow。

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
- `HELM_V2_2_CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_PLAN_V1.md`

## 3. 已经完整成立

### 3.1 Pilot case 分层统计

- continuity queue 现在会被聚合成 workspace-level pilot review
- pilot review 会输出：
  - `totalPilotCases`
  - `failureDistribution`
  - `topFailureClasses`
  - `confidenceBand`
  - `recommendedIneffectiveThreshold`
- 当前这层只统计 continuity surface 内的 failure / recovery / remediation pattern，不扩成更宽的 runtime analytics platform

### 3.2 Calibration profile 再校准

- continuity pilot review 现在会显式给出：
  - default ineffective threshold
  - confidence band summary
  - failure-class adjustment summary
- session-level continuity 现在会同时拿到：
  - class summary
  - drift summary
  - adjustment summary
- 这让 operator 可以区分：
  - 当前只是 session-local noisy posture
  - 还是 pilot 已经表明这个 failure class 应该更早进入 review

### 3.3 Remediation outcome drift review

- pilot review 现在会显式区分：
  - improving
  - stable
  - drifting
  - repeated ineffective
- `/operating` 会显示 drift summary 与 repeated ineffective count
- meeting detail 会显示当前 session 属于哪个 reviewed failure class、当前 band 和建议 threshold

### 3.4 Operator SOP refinement

- continuity SOP 现在不是只给通用 runbook
- 它会基于 failure class 输出：
  - evidence checklist
  - escalation rule
  - common pitfalls
  - boundary note
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md` 已同步扩展为 pilot review / drift / SOP 读法文档

### 3.5 Surface coverage

- `features/meetings/meeting-v2-runtime-card.tsx`
  - 新增 `continuity-pilot-review`
  - 新增 `continuity-sop`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - 新增 `continuity-pilot-cases-card`
  - 新增 `continuity-drift-card`
  - 新增 `continuity-sop-highlights-card`
  - continuity queue 现在会显示 `pilot band/threshold` 与 SOP title

### 3.6 Eval / e2e gate

- 新增：
  - `eval:helm-v2-2-phase7`
  - `eval:helm-v2-2-continuity-pilot-effectiveness-review`
- PR27 eval 会覆盖：
  - pilot-backed distribution
  - drift review
  - calibration profile review
  - session-level pilot guidance
  - SOP refinement
- e2e 会验证：
  - meeting detail pilot review / SOP 可见
  - `/operating` pilot cards、drift summary、SOP highlights 与 queue meta 可见

## 4. 已成形但仍需下一层

- pilot review 目前仍然是 repo-internal pilot sample / rule profile，不是 production telemetry analytics system
- drift review 目前只覆盖 continuity remediation outcome，不是更宽的 operator effectiveness warehouse
- SOP refinement 目前仍然是静态 guidance，不是 interactive diagnostic tree

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

1. pilot sample 仍偏窄，top-tier failure class 和 threshold 建议后续还需要更多真实 pilot 数据再校准
2. 当前 confidence band 偏保守，可能会把“刚开始改善”的链路先压到 review-first posture
3. surface 新增 pilot review / SOP 后，信息密度更高，需要继续靠 operator runbook 和 wording 保持清晰

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
