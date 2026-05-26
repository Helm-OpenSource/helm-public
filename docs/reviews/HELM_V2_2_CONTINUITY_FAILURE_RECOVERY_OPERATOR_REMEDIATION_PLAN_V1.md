---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Failure Recovery And Operator Remediation Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR24 narrow continuity failure recovery / operator remediation slice

## 1. freeze truth 起点

本轮继承以下已冻结口径，不重写已有 continuity 基线：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_OBSERVABILITY_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_CALIBRATION_TRUTH_HARDENING_REPORT_V1.md`

## 2. PR24 要证明什么

PR24 只证明 continuity surface 已经从“可观察”进入“可恢复、可回退、可操作”：

1. continuity failure taxonomy 已明确
2. recovery state model 已可见：`STABLE / RECOVERABLE / REVIEW_REQUIRED / BLOCKED`
3. operator 只能触发 bounded remediation action，不会获得执行权扩张
4. 每次 remediation 都有 before / after + rollback anchor
5. recoverable / review-required / blocked 路径都进入 eval 与 e2e

## 3. exact recovery loop

`meeting-driven runtime session -> continuity posture + replay/payload/failure classification -> recovery state -> bounded operator remediation -> remediation trace (before / after / rollback anchor) -> refreshed continuity posture`

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

- 定义 failure taxonomy
- 定义 recovery state model
- 在 continuity queue / meeting runtime / session trace 中展示 recovery posture

### Phase 2

- 补 bounded remediation actions：
  - save recovery checkpoint
  - resume checkpoint
  - re-prune context
- 生成 remediation trace：
  - before summary
  - after summary
  - rollback anchor

### Phase 3

- 强化 operator readability：
  - 为什么当前是 recoverable / review-required / blocked
  - 为什么允许或不允许某个 remediation
  - rollback anchor 指向哪里

### Phase 4

- 新增或更新 eval fixtures / harness / tests / e2e
- baseline / acceptance report / docs index / self-check / boundary guard 同步

## 6. eval contract

最少覆盖：

1. recoverable path 会给出允许动作和 rollback anchor
2. review-required path 不会静默执行 remediation
3. blocked path 会给出明确 blocked reason
4. remediation trace 会记录 before / after continuity posture
5. rollback anchor 不为空的动作必须可追溯到具体 checkpoint
6. operator surface 不会把 remediation wording 写成 execution authority

## 7. explicitly deferred

本轮明确不做：

- full continuity auto-recovery orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine
