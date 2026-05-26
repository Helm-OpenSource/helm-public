---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Effectiveness Review Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR27 continuity pilot effectiveness review narrow slice

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
- `docs/product/HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REMEDIATION_EFFECTIVENESS_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REMEDIATION_EFFECTIVENESS_REPORT_V1.md`

## 2. PR27 要证明什么

PR27 只证明 continuity operator workflow 已经从“能看到 calibration / effectiveness”进入“能总结 pilot distribution、能看 drift、能细化 SOP”：

1. continuity failure / recovery patterns 可以形成 pilot-backed 分层统计，而不是只看单条 session
2. calibration profile 可以输出 threshold 与 confidence band review，而不是只停在单条 posture
3. remediation outcomes 可以形成 drift review，识别稳定改善、无信号和持续低效场景
4. operator remediation SOP 会按 failure class、evidence 与 escalation timing 细化，而不是只给统一 runbook 文案
5. 所有产物仍是 continuity operator review layer，不扩 execution authority

## 3. exact operator workflow

`continuity sessions -> pilot-backed distribution -> calibration profile review -> remediation drift review -> failure-class SOP refinement -> operator-visible reminder + runbook extension`

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

- continuity pilot review substrate：
  - failure-class distribution
  - top-tier failure classes
  - repeat-pattern frequency
  - pilot-backed count / rate summary

### Phase 2

- calibration profile review：
  - calibrated threshold suggestion
  - confidence band review
  - failure-class adjustment summary

### Phase 3

- remediation drift review + SOP refinement：
  - improvement / stable / drift posture
  - failure-class evidence checklist
  - escalation timing
  - common pitfalls
  - meeting detail / operator queue reminder

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard 同步

## 6. eval contract

最少覆盖：

1. pilot-backed failure distribution 会输出 top-tier failure classes，而不是只给总数
2. calibration profile review 会输出 threshold / confidence band suggestion
3. remediation drift review 会区分 improving / stable / drifting / repeated ineffective posture
4. SOP reminder 会按 failure class 输出 evidence checklist 与 escalation guidance
5. UI 不得把 SOP 写成 execution authority，也不得暗示 auto-remediation
6. runbook / SOP wording 不得越过 judgement-first / no auto-send / no broad auto-write 边界

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
