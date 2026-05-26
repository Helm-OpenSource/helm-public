---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1

状态：Baseline  
Owner：Helm Core  
日期：2026-04-08

## 1. 目的

这份 baseline 冻结 `PR101` 的当前阶段 truth：

- Helm 在 `meeting / email / CRM / report` 四类输入之间，已经形成一条窄的 truth reconciliation engine
- 这条引擎只回答：
  - `resolved`
  - `unresolved`
  - `confidence`
  - `evidence chain`
  - `operator review required`
- 它是 service-level contract，不是 ontology platform、不是 schema migration、not a new runtime orchestration plane

## 2. 当前阶段引用的产品 truth

本轮显式继承：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`

本轮接到的真实业务闭环：

- 第一条真实业务闭环
- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮主要服务：

- 决策
- 审计
- 复盘

## 3. 已经完整成立

### 3.1 narrow truth reconciliation service

仓库现在已经有一条窄的 service-level truth reconciliation engine：

- 支持输入：
  - `meeting`
  - `email`
  - `crm`
  - `report`
- 输出固定为：
  - `resolved`
  - `unresolved`
  - `confidence`
  - `evidence chain`
  - `operator review required`

### 3.2 workspace-scoped subject contract

每条 signal 都必须带：

- `workspaceId`
- `objectType`
- `objectId`
- `claimKey`

也就是说，这条引擎不会做跨 workspace truth 混合。

### 3.3 evidence-first posture

每条 signal 都必须带：

- source identity
- claim value
- summary
- observedAt
- evidence refs

所以这条引擎输出的不是黑盒结论，而是带 evidence chain 的可解释结果。

## 4. 已成形但仍需下一层

以下内容已经成形，但当前仍需下一层：

- canonical `Belief` object
- canonical `OperatingGap` object
- 把 reconciliation result 真正写回 `TruthConflict / WorldModelSnapshot / ProblemSpace`
- operator-facing reconciliation readout
- 自动从 `Meeting / EmailThread / CRM ingress / WeeklyReport` 装载 signal 的 runtime path

## 5. 刻意未做

这轮刻意未做：

- ontology platform
- full BDI runtime
- schema migration
- canonical `Belief / Goal / OperatingGap` 新表
- broader connector platform
- execution-authority expansion
- auto-send
- broad auto-write

## 6. 风险项

### 6.1 过度乐观收敛

如果分数规则把接近冲突写成 `resolved`，会破坏 operator trust。

### 6.2 输入过宽

如果下一轮把 source 扩到更多 provider / runtime，而不先验证证据字段，会让这条窄引擎失去边界。

### 6.3 只停在纯函数层

如果后续不把这条引擎接回 `TruthConflict / OperatingGap / business loop`，它仍只是中间能力，不是经营闭环能力。

## 7. 当前阶段完成定义

PR101 的完成定义不是“有了一个新算法名字”，而是：

1. `meeting / email / CRM / report` 四类输入被明确限制
2. reconciliation 输出被写成固定 contract
3. evidence chain 和 operator review posture 可解释
4. 文档、索引、guard、测试和验证链都对齐
