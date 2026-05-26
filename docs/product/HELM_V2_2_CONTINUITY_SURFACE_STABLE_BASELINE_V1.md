---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Surface Stable Baseline v1

更新时间：2026-04-05
状态：Stable & maintained
适用范围：Helm v2.1 budgeted session continuity + Helm v2.2 continuity operator workflow closeout

## 1. 主口径

当前 continuity surface 已经收口为 `stable & maintained` 基线。

它覆盖的是：

`budgeted session continuity -> recovery posture -> bounded operator remediation -> remediation analytics / evidence / runbook -> pilot calibration / wording consistency / material-impact aging review`

这条线现在继续保留在 current main，但默认进入 `maintenance-only`。
它不再作为当前迭代的主要开发线，也不再默认继续开新的 continuity deepening PR。
当前默认规则可以直接记成：

- `no new continuity deepening PR`
- `real risk or regression`
- `separately scoped plan`

## 2. 当前 truth source

继承：

- `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_MATERIAL_IMPACT_AGING_AUDIT_REFINEMENT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `HELM_V2_2_CONTINUITY_SURFACE_STABLE_CLOSEOUT_REPORT_V1.md`

## 3. 已经完整成立

### 3.1 Runtime continuity substrate and operator posture

- long context externalization、budget posture、notebook、checkpoint / replay / resume、prune trace 已成立
- `SAFE / WATCH / PRUNE / COMPACT`
- `STABLE / RECOVERABLE / REVIEW_REQUIRED / BLOCKED`

### 3.2 Bounded remediation and evidence

- bounded operator remediation action 已成立
- before / after remediation trace、rollback anchor、failure taxonomy、repeat-pattern、evidence surface、operator runbook 已成立

### 3.3 Calibration and continuity review

- pilot calibration、truth hardening、wording consistency、subgroup drift aging、material impact aging review 已成立
- meeting detail、`/operating`、continuity queue、eval、e2e、self-check、boundary guard 都已接好

## 4. stable & maintained 的含义

`stable & maintained` 只表示：

- 当前 continuity readout、operator panel、runbook、eval / e2e、guard 已经足够作为 current-main 稳定基线继续维护
- 后续默认只做 maintenance-only 工作：
  - 真实风险
  - 回归
  - wording drift
  - eval / e2e fail
  - boundary drift

它不表示：

- continuity 这条线还会继续作为当前迭代的主开发方向
- auto-remediation orchestration 已批准
- execution-authority expansion 已打开
- team mode / multi-agent runtime 已开始
- world-model productization 已进入当前排期

## 5. maintenance-only watchlist

只有出现下面这些情况，continuity 才应重新进入开发：

1. replay fidelity / checkpoint continuity 出现真实回归
2. prune / compact / payload externalization 出现真实风险
3. wording drift 重新导致 operator 误读
4. material impact / subgroup drift readout 出现明显失真
5. eval / e2e / self-check / boundary guard 出现持续失败

除此之外，continuity 相关的 drift trend、confidence band、SOP effectiveness 复核都视为维护层 watchlist，不再默认开新 PR 深挖。
对外统一可读成：only reopen on `real risk or regression`.

## 6. 刻意未做

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

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

## 8. 下一步原则

下一个活跃方向必须通过单独、明确的 scoped plan 启动。

这个 closeout 不会自动批准任何新的大方向。
如果后续要进入 execution surface、multi-agent common patterns、world model 深化或其他方向，必须另开计划并重新给出目标、边界、风险与验证。
