---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_OPERATING_GAP_OBJECT_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR102 只做一条窄的 `OperatingGap` object。

它是：

- `operator-governance projection`
- first-class object contract
- runtime operator surface 的最小统一缺口层

它不是：

- schema migration
- canonical persisted object
- ontology platform
- new runtime orchestration plane
- new execution plane

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- `OperatingGap` 是 `PR100` 里已冻结但仍需下一层的对象
- `PR101` 已经把 `unresolved` 与 evidence chain 收紧成窄 contract，这轮可以继续把缺口显式化
- 它直接提升 operator/governance 层可读性，而不是继续扩功能面

## 3. 范围

### In Scope

- 新增 `lib/operating-system/operating-gap.ts`
- 冻结 `OperatingGap` contract、kind、severity、escalation posture
- 只从以下来源投影：
  - `TruthConflict`
  - `ProblemSpace`
  - `CompositionFailure`
- 支持把 `PR101` unresolved reconciliation result 包进同一类 contract
- 在 `RuntimeOperatorPanel` 增加统一 `OperatingGap` queue
- 更新 baseline / plan / report / README / docs / PLANS / guards / tests

### Out of Scope

- 新表
- persistence migration
- KPI link canonicalization
- diagnostics query 扩面
- broader operator redesign
- execution 层动作扩张

## 4. 任务拆解

### Task 1 - freeze docs

- baseline
- plan
- report
- `README / docs/README / PLANS`

### Task 2 - gap contract

- 新增 `OperatingGap` types
- 冻结 `kind / severity / escalation posture`
- 冻结 projection 来源和映射规则

### Task 3 - operator projection

- 把 `TruthConflict / ProblemSpace / CompositionFailure` 收成统一 queue
- 接入 `buildWorkspaceRuntimeOperatorOverview`
- 接到 `RuntimeOperatorPanel`

### Task 4 - guards and validation

- `self-check`
- `boundary-check`
- `pilot-readiness`
- 全验证链

## 5. 验收标准

PR102 完成时必须满足：

1. `OperatingGap` contract 已冻结
2. 只从 `TruthConflict / ProblemSpace / CompositionFailure` 投影
3. `RuntimeOperatorPanel` 已能展示统一缺口队列
4. 文档、guard、测试、索引齐备
5. 完整验证链全绿

## 6. 风险

### 6.1 投影规则过宽

会制造过多 gap 噪音。

### 6.2 投影规则过窄

会漏掉本应在 operator 层被看到的缺口。

### 6.3 双真值

如果把 projection 写成 canonical persisted object，会和现有 runtime truth 形成双真值。
