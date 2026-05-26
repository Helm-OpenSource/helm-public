---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Observability Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：Helm v2.2 narrow next-layer slice

## 1. 当前 freeze truth

v2.2 continuity observability 继承并且不重写以下已冻结结论：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `docs/product/HELM_V2_2_COORDINATION_TRACE_BASELINE_V1.md`

spec 仍是 proposed reference，不自动等于已实现。

## 2. 本次 PR 要证明什么

PR22 只做一条窄 proveout：  
在已存在的 v2.1 continuity substrate 上，把 continuity posture 提升成 operator 可读、可分级、可解释的风险姿态。

核心不是新增执行权，而是让 operator 能快速判断：

1. 哪些 session continuity 风险高，需要先修复 replay/posture
2. 哪些 session 只是 budget-sensitive watch
3. 哪些 session continuity 稳定，可继续沿既有流程推进

## 3. exact loop

`meeting-driven runtime session -> payload state derivation -> replay fidelity posture -> continuity risk level (LOW/WATCH/HIGH) -> workspace operator continuity queue + summary counters -> operator action guidance`

## 4. preserved boundaries

继续保留：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

补 observability 不等于补 authority。

## 5. phase plan

### Phase 1：runtime continuity risk helper

- 增加 continuity risk helper：`LOW / WATCH / HIGH`
- 风险分级基于：
  - replay fidelity（是否 WEAK）
  - budget posture（SAFE/WATCH/PRUNE/COMPACT）
  - payload state derivation
  - prune trace presence
- 输出短摘要 + operator action guidance

### Phase 2：workspace operator surface

- continuity queue 展示：
  - risk level
  - risk summary
  - replay status
  - payload state source
- operator summary 增加：
  - weak replay sessions
  - high continuity risk sessions
  - checkpoint-derived continuity sessions

### Phase 3：eval / test

- 新增 v2.2 continuity observability eval harness
- 覆盖 high/watch/low 风险姿态与 action guidance
- 补对应 test，保证回归可检

### Phase 4：docs freeze + index

- 基线文档 + 报告文档
- docs index 同步
- package eval script 入口同步

## 6. eval contract

至少验证：

1. replay `WEAK` 必须上升为 `HIGH` continuity risk
2. budget-sensitive posture 必须可见 `WATCH` risk
3. 安全 posture 必须保持 `LOW` 风险，不被误报
4. 每个风险级别都必须给出 operator 可执行的短 action guidance
5. operator queue 必须显示 replay/payload source/risk posture，不是隐藏状态

## 7. explicitly deferred

本 PR 不做：

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- broader platform expansion
- full continuity auto-recovery orchestrator

## 8. done definition

本 slice 只有在以下条件同时成立时完成：

1. continuity risk 在 runtime + operator surface 上可分级可解释
2. weak replay、budget watch、stable posture 三种状态可区分
3. eval / test / docs / script / index 同步完成
4. 验证为绿色且边界未被放大
