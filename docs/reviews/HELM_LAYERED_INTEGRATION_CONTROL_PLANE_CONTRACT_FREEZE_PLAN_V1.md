---
status: archived
owner: helm-core
created: 2026-04-12
review_after: 2026-10-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目标

本轮只执行 `Track G1 / G2`：

1. 冻结 Helm 第一方 control plane 与外部 adapter / engine 的 ownership 边界
2. 冻结 6 个最小 contract：
   - `SourceAdapter`
   - `ObjectProjection`
   - `ActionIntent`
   - `ReviewBundle`
   - `ExecutionReceipt`
   - `ReconciliationResult`
3. 为单闭环 POC 提供统一前置合同

本轮不是：

- vendor 选型
- connector runtime 实现
- execution engine 接线
- schema migration
- workflow builder 设计
- authority expansion

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_V2_FOUNDATION_PRD_V1.md`
- `docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`
- `docs/product/HELM_V2_DATA_MODEL_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_ACTION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md`

本轮接到的真实业务闭环：

- `external source signal -> object projection -> Helm judgement -> review -> guarded execution -> receipt -> memory write-back`

本轮服务的角色：

- 决策
- 执行
- 审计
- 复盘

本轮为什么现在做：

- 它直接降低后续 adapter / execution POC 的 contract 漂移
- 它避免在没有 ownership 边界时过早绑定外部系统
- 它符合“真实业务闭环优先于平台化”和“review-before-commitment 优先于执行扩权”

## 3. 范围

### In Scope

- 冻结 Helm 第一方 ownership matrix
- 冻结 6 个 contract 的最小字段、责任边界和不变量
- 冻结单闭环 POC 的合同前提
- 更新 `PLANS.md`
- 更新 `docs/README.md`
- 补 plan 文档索引与验证说明

### Out of Scope

- 任何具体 vendor 绑定
- connector / adapter runtime
- orchestration runtime
- execution retry / scheduler substrate
- canonical object schema 扩张
- new queue / approvals surface
- write authority 扩张

## 4. Ownership Matrix

本轮先冻结 ownership，不先冻结厂商。

### 4.1 External Source / System of Record

外部系统负责：

- 原始业务对象与原始事件
- source-native schema
- source-native read cursor / sync token

Helm 不负责：

- 抢占 external object canonical ownership
- 在当前阶段复制完整 source schema

### 4.2 Helm Projection / Judgement / Memory

Helm 负责：

- object-centered projection
- cross-source summary
- evidence linkage
- judgement formation
- memory write-back
- review / policy / audit contract

外部系统不负责：

- Helm judgement authority
- Helm approval posture
- Helm memory truth

### 4.3 External Execution Engine

外部执行层可负责：

- low-level job execution
- retries
- scheduling
- workflow plumbing

但不负责：

- 决定是否值得执行
- 绕过 Helm review
- 替代 Helm 形成 commitment truth

### 4.4 Helm Review / Reconciliation

Helm 继续第一方负责：

- `recommendation != commitment`
- `review-before-commitment`
- policy checks
- execution receipt interpretation
- post-execution reconciliation
- audit / replay / follow-through

## 5. 六个 Contract

以下 6 个 contract 是本轮必须冻结的最小合同。

### 5.1 `SourceAdapter`

目的：

- 定义 Helm 如何与外部 source 建立受控读取关系

最小字段：

- `adapterKey`
- `workspaceId`
- `sourceKind`
- `externalAccountRef`
- `capabilities`
- `subjectMapping`
- `evidenceMode`
- `cursorState`
- `syncPosture`

必须成立的不变量：

1. workspace-scoped
2. capability-scoped
3. read posture 明确，不默认为 write
4. source identity 与 evidence linkage 可追溯

当前不做：

- source schema 全量复制
- cross-workspace source merge
- source-native write-back

### 5.2 `ObjectProjection`

目的：

- 定义 Helm 如何把外部 source record 压成经营对象视图，而不是复制原系统

最小字段：

- `projectionKey`
- `workspaceId`
- `objectKind`
- `objectRef`
- `sourceRefs`
- `subjectKey`
- `summary`
- `evidenceRefs`
- `freshness`
- `projectionStatus`

必须成立的不变量：

1. projection 不是 canonical source ownership
2. projection 必须可追溯回 sourceRefs
3. evidenceRefs 不能为空集合语义
4. workspace 不能漂移

当前不做：

- canonical business object schema migration
- projection-driven external overwrite
- projection 自动变成 commitment object

### 5.3 `ActionIntent`

目的：

- 定义 Helm 已形成的下一步动作候选，但仍未 commit

最小字段：

- `intentKey`
- `workspaceId`
- `objectRef`
- `intentKind`
- `requestedEffect`
- `draftPayload`
- `preconditions`
- `riskClass`
- `recommendedOwner`
- `intentStatus`

必须成立的不变量：

1. intent 不是 commitment
2. intent 不能隐式获得 send / write authority
3. riskClass 必须进入 review 分流
4. draftPayload 必须可回退

当前不做：

- direct-to-send intent
- auto-commit intent
- 脱离 review surface 的 write path

### 5.4 `ReviewBundle`

目的：

- 定义高风险动作进入正式复核前，Helm 必须展示的完整审查合同

最小字段：

- `bundleKey`
- `workspaceId`
- `intentRef`
- `recommendationSummary`
- `boundaryNotes`
- `evidenceRefs`
- `policyChecks`
- `approvalRequirement`
- `allowedExecutionMode`
- `manualFallback`

必须成立的不变量：

1. `recommendation != commitment`
2. 没有 `ReviewBundle` 就不能进入 guarded write
3. boundary / prerequisite / dependency 必须显式存在
4. manual fallback 必须存在

当前不做：

- review bypass
- hidden policy execution
- approval-less high-risk write

### 5.5 `ExecutionReceipt`

目的：

- 定义外部执行后的回执、异常与状态证据

最小字段：

- `receiptKey`
- `workspaceId`
- `intentRef`
- `targetSystem`
- `executorRef`
- `executionStatus`
- `externalRunRef`
- `acknowledgedAt`
- `resultEvidence`
- `exceptionSummary`

必须成立的不变量：

1. receipt 不是 business outcome success 的同义词
2. 没有 receipt，不能宣称 official execution completed
3. exception 不能被吞掉
4. receipt 必须可挂回 intent 和 evidence

当前不做：

- broad execution telemetry platform
- external engine 成为唯一 truth owner
- 无回执的 optimistic success 标记

### 5.6 `ReconciliationResult`

目的：

- 定义执行后 Helm 如何把 receipt 回收成 object state / memory / follow-through truth

最小字段：

- `reconciliationKey`
- `workspaceId`
- `receiptRef`
- `objectUpdates`
- `memoryWrites`
- `unresolvedItems`
- `followThroughRequired`
- `operatorReviewRequired`
- `reconciliationStatus`

必须成立的不变量：

1. reconciliation 可以产出 unresolved，不强行 resolved
2. memory write-back 不等于业务成功
3. operator review required 必须诚实保留
4. 任何 objectUpdates 都必须可追溯到 receipt / evidence

当前不做：

- automatic cross-system truth overwrite
- full world-model sync
- reconciliation 自动扩权成 workflow engine

## 6. 单闭环 POC 前提

后续只有满足以下前提，才允许进入 `G3 / G4 / G5`：

1. 6 个 contract 已冻结
2. ownership matrix 已明确
3. review boundary 无歧义
4. receipt / reconciliation 不会被省略
5. 真实业务闭环被收窄到单条链路

推荐的唯一闭环：

- `meeting/email/CRM signal -> ObjectProjection -> ActionIntent -> ReviewBundle -> guarded execution -> ExecutionReceipt -> ReconciliationResult`

## 7. 任务拆解

### Task 1 - Freeze ownership boundary

- 明确 external source / Helm / external execution 的职责边界
- 明确哪些 truth 继续由 Helm first-party 持有

### Task 2 - Freeze six contracts

- 为 6 个 contract 冻结最小字段
- 为 6 个 contract 冻结不变量
- 为 6 个 contract 冻结 out-of-scope

### Task 3 - Define POC entry gate

- 写清单闭环前提
- 写清 candidate evaluation 只允许发生在 contract freeze 之后

### Task 4 - Sync plan surfaces

- 更新 `PLANS.md`
- 更新 `docs/README.md`
- 保持 review / plan 索引可发现

## 8. 验收标准

本轮完成时必须满足：

1. 6 个 contract 都有：
   - 目的
   - 最小字段
   - 不变量
   - 当前不做
2. ownership matrix 已明确 external source / Helm / external execution 分工
3. 单闭环 POC 入口条件已明确
4. 没有 vendor binding、platformization 或 authority expansion 过度承诺
5. `PLANS.md` 与 `docs/README.md` 已同步
6. 基础验证通过

## 9. 风险

### 9.1 Contract 写得过虚

如果只有抽象名词，没有最小字段与不变量，后续仍然无法实施。

### 9.2 Projection 偷偷变成 canonical ownership

如果 `ObjectProjection` 字段设计漂到 canonical object，就会把范围推成 schema 工程。

### 9.3 Receipt 被误写成 success

如果 `ExecutionReceipt` 被直接等同于结果成功，会破坏 follow-through 和 exception truth。

### 9.4 Reconciliation 偷偷变成 workflow engine

如果 `ReconciliationResult` 扩张成跨系统自动收敛，就会超出当前阶段边界。

## 10. 本轮完成定义

本轮完成，不看“有没有接上外部工具”，只看：

- ownership 是否已经不再含糊
- 6 个 contract 是否足够支撑单闭环 POC
- review-before-commitment 是否被继续前置
- 后续 adapter 讨论是否不再需要回到“谁拥有什么 truth” 的争论

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

下一版计划文档见：

- [HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md](./HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md)
