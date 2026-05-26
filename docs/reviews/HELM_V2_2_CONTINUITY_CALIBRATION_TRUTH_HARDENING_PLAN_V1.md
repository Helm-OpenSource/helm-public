---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration And Truth Hardening Plan v1

更新时间：2026-04-04  
状态：Proposed Kickoff  
适用范围：PR23 narrow continuity calibration + truth hardening slice

## 1. freeze truth 起点

本轮继承以下已冻结口径，不重写 v2.1/v2.2 基线：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_CONTINUITY_CORRECTNESS_HARDENING_REPORT_V1.md`
- `docs/product/HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_OBSERVABILITY_REPORT_V1.md`

## 2. PR23 要证明什么

PR23 不是只做阈值观察，而是 continuity calibration + truth hardening：

1. pilot-backed calibration：`LOW/WATCH/HIGH`、`replayStatus`、`payloadStateSource`
2. prune/resume 的 confirmed facts 口径继续收紧到 promoted truth
3. multi-prune history 语义可追溯，禁止 context edit 静默覆盖
4. replay fidelity 覆盖范围扩展并进入 eval

## 3. preserved boundaries

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

## 4. phase plan

### Phase 1

- 引入 continuity calibration profile（pilot-backed）
- `buildRuntimeContinuityRisk`、`replayStatus`、`payloadStateSource` 全部接入校准口径

### Phase 2

- prune/resume 的 confirmed facts 严格使用 promoted candidate + promotion ledger
- promoted-truth-only continuity facts 不允许从 raw facts payload 旁路进入
- 去掉 latest-edit 依赖，改为多次 prune fold 语义

### Phase 3

- context edit 改 append-only，保留多次 prune 历史，不再 upsert 覆盖
- prune trace 改历史视角（多条记录按时序可读）

### Phase 4

- replay fidelity 扩字段（含 boundary/source posture 等）
- 补 eval fixtures/harness/tests/scripts
- baseline/report/docs index/self-check/boundary guard 同步

## 5. eval contract

最少覆盖：

1. replay status 校准：`STRONG/WATCH/WEAK`
2. payload source 风险校准：`checkpoint_snapshot/checkpoint_plus_edits/latest_prune_edit/all_persisted`
3. risk posture 校准：`LOW/WATCH/HIGH`
4. confirmed facts 只来自 promoted truth
5. multi-prune 历史不会静默覆盖
6. replay fidelity 扩字段后仍可解释并可回归验证

## 6. explicitly deferred

本轮明确不做：

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
