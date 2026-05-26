---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Calibration And Truth Hardening Report v1

更新时间：2026-04-04  
状态：Implemented  
适用范围：PR23 narrow continuity calibration + truth hardening slice

## 1. 本轮目标

PR23 目标不是只看阈值趋势，而是把 continuity runtime 的校准与真值纪律同时收紧：

1. pilot-backed calibration（risk/replay/payload）
2. confirmed facts source discipline（prune/resume）
3. multi-prune history 与 no silent overwrite
4. replay fidelity 扩覆盖 + eval

## 2. 本轮落地

### 2.1 calibration runtime helpers

- `buildRuntimeContinuityRisk` 接入 calibration profile
- 新增：
  - `classifyReplayFidelityStatus`
  - `classifyPayloadStateSourceRisk`
- replay status 现为 `STRONG/WATCH/WEAK`

### 2.2 truth discipline in prune/resume

- prune/resume continuity path 全部以 promoted candidate + promotion ledger 构建 confirmed facts
- meeting review checkpoint snapshot 的 confirmed facts 也改为 candidate/promotion 来源，不再直接取 facts payload

### 2.3 multi-prune history + no silent overwrite

- context edit 写入从 upsert 改 append-only create（唯一 key 带时间与随机后缀）
- payload active/pruned state 推导从“latest edit”改为“checkpoint + prune history fold”
- prune trace 改按历史排序并标记 history step

### 2.4 replay fidelity widening

- fidelity checks 增补：
  - boundary note
  - payload source posture
  - confirmed fact evidence
- replay summary 新增 `WATCH` 解释路径

### 2.5 eval/docs/guards

- 新增 fixture：
  - `evals/helm-v2/continuity-observability-v2_2-golden-samples.json`
- continuity harness 改为 fixture 驱动并新增两项 rate：
  - `replayStatusRate`
  - `payloadSourceRiskRate`
- v2.1 budgeted continuity fixture 增加 `WATCH` replay case
- `self-check` 与 `docs index` 同步到 PR23 文档与 fixture

## 3. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion

## 4. deferred

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write

## 5. validation

本轮执行并通过：

- `npm run typecheck`
- `npm run test -- lib/helm-v2/runtime-upgrade.test.ts lib/helm-v2/eval-harness.test.ts`
- `npm run eval:helm-v2-2-continuity-observability`
- `npm run eval:helm-v2-2-phase2`

最终收口验证见本轮 closeout 结果。
