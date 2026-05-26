---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档不是继续扩写“完整技术栈方案”，而是把一份外部详细方案收口成 Helm current-main 可以接受的 `G3 / G4` 计划。

它回答 4 件事：

1. 在你给出的候选名单里，谁最像 Helm 的对象层、执行层、AI workflow 层、治理层
2. 这份详细技术方案里，哪些部分可以吸收、哪些必须改写、哪些当前不应进入主线
3. 如果进入下一步，单闭环 POC 应该基于 current-main 哪些现有 seam，而不是从零开新平台层
4. `Track G3 / G4` 应该如何进入后续计划

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`
- `docs/product/HELM_V2_DATA_MODEL_V1.md`
- `docs/product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_ACTION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md`

本轮接到的真实业务闭环：

- `source signal -> projection -> judgement -> review -> guarded execution -> receipt -> reconciliation`

本轮服务的角色：

- 决策
- 执行
- 审计
- 复盘

本轮为什么现在做：

- 用户已经给出更细的技术路线，必须先做 repo-truth review，避免把 detail 误写成 direction
- current-main 已经有 connector / import / review / receipt / follow-through seam，优先复用比重开平台层更符合当前边界
- `G1 / G2` 已完成 contract freeze plan，下一步自然就是 `G3 / G4`

## 3. 分层对标结论

以下判断只基于当前讨论里的候选名单和 Helm repo truth，不等于正式 vendor selection。

### 3.1 对象层：`Twenty` 最像外部对象层邻近物

如果只看外部产品类型相似度：

- `Twenty` 最接近 “现代 CRM / object system of record” 邻近层
- `Corteza` 更像 self-hosted / enterprise CRM 邻近层

但对 Helm 当前 repo 来说，真正更接近的起点不是直接接 `Twenty`，而是现有：

- `Connector`
- `ImportSource`
- `ImportJob`
- `ImportItem`
- CRM import orchestrator

也就是说：

- 外部邻近物：`Twenty`
- current-main POC 起点：现有 `lib/connectors/*` + `lib/imports/*`

### 3.2 执行层：`Windmill` 最像外部执行层邻近物

如果只看外部产品类型相似度：

- `Windmill` 最像 execution substrate / job execution 邻近层
- `n8n` 更像 SMB automation 邻近层

但对 Helm 当前 repo 来说，真正更接近的执行起点是现有：

- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`

也就是说：

- 外部邻近物：`Windmill`
- current-main POC 起点：现有 guarded execution / official write path

### 3.3 AI Workflow 层：`Dify` 最像外部 AI workflow 邻近物

如果只看你给出的候选名单：

- `Dify` 最像 generic AI workflow / model routing / app builder 邻近层
- `Plane` 更像协作和项目工作台邻近层，不是 AI workflow 主邻近物

但对 Helm 当前 repo 来说，AI workflow 的主起点仍然应该是现有：

- `meeting-ended` runtime
- opportunity judge
- draft comms / handoff runtime
- memory pipeline

也就是说：

- 外部邻近物：`Dify`
- current-main POC 起点：现有 `lib/helm-v2/*` + `meeting detail` runtime

### 3.4 治理层：没有直接等价竞品

治理层最接近的是一组邻近物，而不是单一对标产品：

- approval / BPM 工具
- AI governance 工具
- audit / compliance 系统

但 Helm 当前最有差异化的正是：

- `judgement-first`
- `review-before-commitment`
- `recommendation != commitment`
- `receipt + follow-through + reconciliation`

所以治理层当前仍应保持：

- external adjacency：只有相邻类型
- actual owner：Helm first-party

## 4. 对详细技术方案的 Review

### 4.1 可以直接吸收

#### A. 分层思路

- 对象层、执行层、AI workflow 层、治理层分层看问题，这个思路成立

#### B. 单闭环优先

- 不应该一上来做 broad platform
- 应该先证明一条真实业务闭环

#### C. transform / projection / enrichment 分离

- `source -> normalize -> project -> judge -> review -> execute -> reconcile` 这个顺序成立

#### D. 统一对象视图作为 projection

- “统一业务对象视图” 这个目标可以保留
- 但它必须是 projection / evidence view，不是新的 canonical CRM

### 4.2 需要改写后吸收

#### A. 目录结构

方案里新增：

- `integrations/`
- `features/intelligence/`

这不符合 current-main 的优先路径。

更合理的落点应该继续沿现有目录：

- `lib/connectors/*`
- `lib/imports/*`
- `app/api/connectors/*`
- `app/api/imports/*`
- `lib/helm-v2/*`
- `lib/operating-system/*`
- `features/meetings/*`
- `features/approvals/*`

#### B. 数据模型

方案里新增：

- `IntegrationConfig`
- `TwentyPerson`
- `TwentyDeal`
- `TwentyInteraction`
- `GoogleEvent`
- `GmailMessage`
- `BusinessObject`
- `SyncLog`

这组模型当前不适合直接进入主线。

更合理的路径是复用现有 seam：

- `Connector`
- `ImportSource`
- `ImportJob`
- `ConnectorIngestionRecord`
- `RuntimeEvent`
- `ArtifactBundle`
- `MemoryItem`
- `ApprovalRequest`
- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`

#### C. API 结构

方案里新增：

- `api/unified-data/route.ts`
- `api/intelligence/route.ts`

当前也不适合作为第一步。

更合理的是：

- 继续沿 `app/api/connectors/*`
- `app/api/imports/*`
- `app/api/runtime/*`
- `app/api/helm-v2/runtime/*`

先证明 contract，不先开新的“统一数据 / 智能分析 API 平台”。

#### D. UI 入口

方案里主 UI 是：

- 智能 CRM 面板
- 统一业务对象视图

这会把 Helm 往 CRM front-end 拉。

当前更合理的 UI 起点应该是：

- meeting detail runtime cards
- approvals review surface
- dashboard / operating readout

也就是先证明 judgement / review / receipt / follow-through，而不是先证明“新 CRM 面板”。

### 4.3 当前不建议采纳

#### A. 新依赖与新基础设施

当前不建议直接引入：

- `BullMQ`
- `Redis`
- `@twentyhq/*` SDK
- `googleapis`

原因不是这些工具一定错，而是：

- 当前 repo 已有 connector / import / runtime seam
- 在没有完成 POC 设计前直接引依赖，会让实现顺序倒置

#### B. vendor-specific canonical tables

不建议直接落：

- `TwentyPerson`
- `TwentyDeal`
- `GoogleEvent`
- `GmailMessage`

当前更适合的是：

- source-scoped connector/import record
- object projection
- evidence linkage

而不是 vendor-specific canonical store。

#### C. 自动 source write-back

方案中的：

- `POST /api/unified-data`
- `syncToSource(type, created)`

直接冲当前边界。

任何外部 write-back 都必须经过：

- `ActionIntent`
- `ReviewBundle`
- `OfficialWriteIntent`
- `ExecutionReceipt`
- `OfficialFollowThrough`

#### D. `BusinessObject` 新 canonical table

当前不建议直接新增统一 `BusinessObject` 表。

原因：

- current-main 仍是 object projection / cognitive object / operating object baseline
- 现在直接引入 canonical table，范围会立刻扩成 schema migration 和 object model rewrite

#### E. 智能评分字段直接写成 truth

例如：

- `healthScore`
- `churnRisk`
- `priorityScore`

这类字段当前不能直接成为 persisted business truth。

更合理的形态是：

- runtime recommendation
- reviewable projection
- evidence-backed summary

## 5. 用 current-main 做 POC 的建议映射

### 5.1 `SourceAdapter`

优先映射到现有：

- `Connector`
- `ImportSource`
- `lib/connectors/*`
- `lib/imports/*`

第一轮候选 source 不应是“新 Twenty 接入”，而应是：

- 当前 Google connector
- 当前 CRM import seam

### 5.2 `ObjectProjection`

优先映射到现有：

- `ConnectorIngestionRecord`
- `truth-reconciliation.ts`
- `cognitive-object-contract.ts`
- `goal-driven-home.ts`

也就是先做 projection / summary / evidence，而不是新建 CRM canonical object。

### 5.3 `ActionIntent`

优先映射到现有：

- governed action create path
- meeting runtime 生成的 action candidate
- `HumanActionExecution` 前置意图语义

### 5.4 `ReviewBundle`

优先映射到现有：

- `ApprovalRequest`
- approvals surface
- meeting detail review cards
- governed-action review posture

### 5.5 `ExecutionReceipt`

优先映射到现有：

- `HumanActionExecution.executionProof*`
- `OfficialWriteIntent.writeAcknowledgement*`
- meeting detail ack / receipt readout

### 5.6 `ReconciliationResult`

优先映射到现有：

- `OfficialFollowThrough`
- `MemoryItem`
- runtime follow-through sync / update

## 6. `Track G3 / G4` 的后续计划

### G3 - Vendor Fit Matrix

本轮只做 matrix，不做接线。

候选比较维度：

1. contract fit
2. workspace / tenant isolation
3. review bypass 风险
4. receipt / reconciliation 支持度
5. manual fallback
6. demo / mock fallback 能力

候选优先级建议：

- Source candidate：
  - 第一优先：current-main 已有 source seam
  - 第二优先：`Twenty`
- Execution candidate：
  - 第一优先：current-main 已有 guarded execution seam
  - 第二优先：`Windmill`
- AI workflow assist candidate：
  - 第一优先：current-main meeting/runtime seam
  - 第二优先：`Dify`
- Governance：
  - 保持 Helm first-party，不做外包 candidate

### G4 - Single-loop POC Plan

推荐唯一闭环：

- `meeting / email / CRM import signal`
- `ConnectorIngestionRecord / projection`
- `truth reconciliation / judgement`
- `ApprovalRequest / review surface`
- `HumanActionExecution or OfficialWriteIntent`
- `ExecutionReceipt`
- `OfficialFollowThrough / MemoryItem write-back`

这条链的关键是：

- 不新增 vendor-specific canonical schema
- 不新增 workflow builder
- 不新增 broad automation plane
- 先把已有 seam 接成一条更清楚的 control-plane proof

## 7. 受影响组件

如果后续进入 `G3 / G4`，主要影响面应继续落在：

- `lib/connectors/*`
- `lib/imports/*`
- `app/api/connectors/*`
- `app/api/imports/*`
- `app/api/runtime/*`
- `app/api/helm-v2/runtime/*`
- `features/meetings/*`
- `features/approvals/*`
- `lib/helm-v2/*`
- `lib/operating-system/*`
- `prisma/schema.prisma`

当前明确不建议新增第一轮影响面：

- `integrations/`
- `features/intelligence/`
- 新的 vendor-specific canonical model 区块

## 8. 风险

### 8.1 把 vendor adjacency 当成 implementation path

“Twenty 最像对象层” 不等于 “现在就接 Twenty”。

### 8.2 把 projection 当成 canonical ownership

一旦 `ObjectProjection` 变成新主表，范围会迅速失控。

### 8.3 把 receipt 当成 success

执行回执必须和业务结果、后续跟进分开。

### 8.4 把 AI score 当成 truth

评分、风险、优先级当前都应保留为 reviewable posture，而不是直接变成 persisted business fact。

## 9. 本轮完成定义

本轮完成，不看“技术方案写得多完整”，只看：

- 是否已经清楚回答谁最像各层邻近物
- 是否已经清楚说明为什么 current-main 不能原样采用该方案
- 是否已经把可吸收部分接到 `G3 / G4`
- 是否已经把 future POC 路线收窄到现有 seam

## 10. 下一步建议

如果继续沿这条线执行，下一步只做两件事：

1. 固定 `G3` candidate evaluation matrix
2. 起草 `G4` 单闭环 POC 入口条件与验收标准

不要先做：

- Twenty SDK 接线
- Windmill SDK 接线
- 新 Prisma vendor tables
- 新“智能 CRM 面板”

当前 `G3` 文档见：

- [HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md)

## 11. 验证

建议验证仍然是：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

本轮默认至少运行：

- `npm run self-check`
- `npm run check:boundaries`
