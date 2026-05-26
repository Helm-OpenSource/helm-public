---
status: active
owner: helm-core
created: 2026-04-24
review_after: 2026-07-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Memory Observability Budgeting Read-Only Adoption Plan V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 当前 truth source

这份 plan 建立在以下 current-main 文档之上：

- [HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md)
- [HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md)
- [HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md)
- [HELM_MEMORY_DIAGNOSTICS_TRACE_ALIGNMENT_REPORT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_MEMORY_DIAGNOSTICS_TRACE_ALIGNMENT_REPORT_V1.md)
- [HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md)

## 2. 为什么现在开这条 plan

Harness gap 顺序已经完成前三刀：

1. `Extension Bundle + Capability Manifest`
2. `Capability Resolution Engine`
3. `Monitor Substrate`

第四刀应该继续按 gap analysis 进入 `Memory Observability and Budgeting`，但不能直接做完整 memory runtime、trace ledger、distillation runtime 或 auto-promotion。

因此本轮只做：

- read-only memory observability budget readout
- operator-facing memory index
- load budget posture
- loaded / skipped load trace explanation

## 3. 这条 slice 要证明什么

本轮只证明：

已有 `MemoryRetrievalPackSurfaceTrace` 可以被收成统一的 `memory index + load budget + load trace`，帮助 operator 理解“加载了什么、跳过了什么、为什么预算有压力”。

本轮不证明：

- 已经存在完整 memory trace ledger
- 已经存在 startup memory runtime
- 已经接管 retrieval pack selection
- 已经接管 recommendation ranking
- 已经启动 distillation runtime
- 已经允许 auto-promotion / canonical fact rewrite / broad write-back

## 4. 精确范围

### 第一批 readout

本轮只新增：

- `buildMemoryObservabilityBudgetReadout`
- `buildMemoryObservabilityBudgetSummary`

### 第一批输入

本轮只接受已有只读 trace：

- `MemoryRetrievalPackSurfaceTrace`

### 第一批输出

本轮只输出：

- `memoryIndex`
- `loadBudget`
- `loadTrace`
- `operator.summary`
- `operator.nextMove`
- `operator.boundaryNotes`

### 第一批 source chain

本轮只要求四段式：

- `trace_truth`
- `index_scope`
- `load_budget`
- `authority_boundary`

## 5. 保留边界

继续明确保留：

- `judgement-first`
- `review-first`
- `recommendation != commitment`
- memory observability 不等于 memory runtime
- memory observability 不等于 trace ledger
- memory observability 不等于 distillation runtime
- memory observability 不接管 retrieval selection
- memory observability 不接管 recommendation ranking
- memory observability 不做 auto-promotion
- memory observability 不做 canonical fact write-back

## 6. phase plan

### Phase 1

- 引入 pure readout builder
- 覆盖 healthy trace、budget pressure、fallback trace、missing trace、summary aggregation

### Phase 2

- 同步 `PLANS.md`、`docs/README.md` 和本轮 report

### Phase 3

- 接入 `self-check`
- 接入 `check:boundaries`
- 运行 targeted tests 和标准验证链

## 7. 下一步边界

如果本轮验证通过，下一阶段只能二选一：

1. 继续做 `Swarm Isolation + Task Ledger + Plan Gate`
2. 把 memory observability readout 接入 operator diagnostics，但仍保持 read-only

不建议下一步直接做 full trace ledger、distillation runtime、auto-promotion 或 startup memory runtime。
