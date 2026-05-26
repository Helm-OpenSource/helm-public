---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Calibration Review Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR28 continuity pilot calibration review narrow slice

## 1. freeze truth 起点

本轮继承以下 continuity freeze，不重写前序基线：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_FAILURE_RECOVERY_OPERATOR_REMEDIATION_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_REMEDIATION_ANALYTICS_OPERATOR_RUNBOOK_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REMEDIATION_EFFECTIVENESS_BASELINE_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_PILOT_EFFECTIVENESS_REVIEW_REPORT_V1.md`

## 2. PR28 要证明什么

PR28 只证明 continuity operator workflow 已经从“能看 pilot distribution / drift / SOP”进入“能按 cohort 复核 threshold、confidence、drift 和 operator handling effectiveness”：

1. pilot cases 可以形成更细粒度 cohort，而不是只停在全量聚合
2. threshold / confidence band 可以按 cohort 复核，而不是只给全局建议
3. drift metrics 可以按 cohort 比较 repeat ineffective posture 与 effectiveness change
4. SOP 命中率与 operator 处理结果可以形成 operator-handling effectiveness summary
5. 所有输出仍是 continuity operator review layer，不扩 execution authority

## 3. exact operator workflow

`continuity sessions -> cohort review -> threshold/confidence recalibration -> drift metric review -> SOP hit-rate review -> operator-visible calibration note + handling effectiveness note`

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

- pilot cohort substrate：
  - cohort key derivation
  - cohort-level failure distribution
  - cohort-level remediation success rate
  - cohort-level drift summary

### Phase 2

- threshold / confidence recalibration：
  - threshold suggestion by cohort
  - confidence band revision note
  - low / high risk band adjustment summary

### Phase 3

- drift review + operator handling effectiveness：
  - drift rate over time
  - repeat ineffective trend
  - SOP hit / skip / ineffective-after-hit summary
  - meeting detail / operator queue reminder

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard 同步

## 6. eval contract

最少覆盖：

1. cohort-level failure distribution 与 remediation outcome success rate 可见
2. threshold / confidence recalibration 会输出 cohort-based 建议，而不是只重复旧全局口径
3. drift metrics 会区分 cohort 间的 trend 差异
4. SOP hit-rate review 会显示 hit / skip / ineffective-after-hit posture
5. UI 不得把 calibration review 或 SOP 对照写成 execution authority，也不得暗示 auto-remediation
6. 所有 wording 必须继续保持 judgement-first / no auto-send / no broad auto-write 边界

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
