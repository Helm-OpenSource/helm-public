---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration And Truth Hardening Baseline v1

更新时间：2026-04-04  
状态：Baseline  
适用范围：PR23 narrow continuity calibration + truth hardening

## 1. 主口径

PR23 冻结的是 continuity runtime 的“校准 + 真值纪律”层：

- continuity posture 不只可见，还要有 pilot-backed calibration
- confirmed facts 在 prune/resume 路径继续保持 promoted-truth-only
- multi-prune history 不允许静默覆盖
- replay fidelity 评价范围继续扩大并可回归验证

## 2. 已完整成立

### 2.1 pilot-backed calibration

- replay status 从二值扩展为 `STRONG/WATCH/WEAK`，由 calibration profile 判定
- payload state source 有明确风险权重映射：
  - `checkpoint_snapshot` -> LOW
  - `checkpoint_plus_edits` -> WATCH
  - `latest_prune_edit` -> WATCH
  - `all_persisted` -> LOW
- risk level 统一经 calibration profile 给出 `LOW/WATCH/HIGH`

### 2.2 source discipline hardening

- prune/resume 路径的 notebook confirmed facts 继续只从 promoted candidate/promotion ledger 生成
- continuity snapshot 不再从“facts payload 原文”直接推 confirmed facts

### 2.3 multi-prune history semantics

- context edit 改为 append-only，避免同 key upsert 覆盖历史
- payload state 推导改为 checkpoint + prune history fold，不再只看 latest edit
- prune trace 按历史可读展示，保留多次 prune 语义

### 2.4 wider replay fidelity

- replay fidelity 增补字段检查：
  - `boundary note`
  - `payload source posture`
  - `confirmed fact evidence`
- replay summary 能区分 `STRONG/WATCH/WEAK`

### 2.5 eval coverage 扩展

- 新增 v2.2 continuity observability calibration fixture
- harness 同时验证：
  - replay status calibration
  - payload source risk calibration
  - risk level calibration
  - operator explanation/action consistency
- v2.1 budgeted continuity fixture新增 `WATCH` replay case

## 3. 已成形但仍需下一层

- calibration 仍是规则层，不是统计学习模型
- payload state 仍以“当前态准确”优先，不是 full event-sourcing replay engine
- 长周期跨租户真实 pilot 下的阈值微调仍需要更多数据

## 4. 刻意未做

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion

## 5. preserved boundaries

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
