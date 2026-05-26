---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_READOUT_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR105 只做一条窄的 business-loop gap readout。

它是：

- shared business-loop gap readout
- `dashboard / reports / operating` 的统一读取口径
- 基于窄查询入口的 operator-governance readout

它不是：

- schema migration
- canonical persisted object
- KPI canonicalization
- dashboard analytics refactor
- ontology platform
- execution-authority expansion

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `docs/product/HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `docs/product/HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `docs/product/HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- `PR104` 已把 `businessLoopGapSummary` 收成共享 runtime summary，但 `dashboard / reports` 还没有消费它
- 当前阶段更重要的是让高频 operator-heavy surface 共享同一份主业务闭环缺口，而不是继续扩散页面内联判断
- 这条线直接提升业务闭环缺口的首屏前置一致性，优先级高于再做说明层扩面

## 3. 范围

### In Scope

- 新增 `getWorkspaceBusinessLoopGapReadout`
- 让 `dashboard` 消费共享 `businessLoopGapSummary`
- 让 `reports` 消费共享 `businessLoopGapSummary`
- 保持首屏只保留四类信息
- 更新 baseline / plan / report / README / docs / PLANS / guards / tests

### Out of Scope

- 新表
- persisted `OperatingGap`
- KPI schema / goal schema
- dashboard analytics refactor
- broader operator redesign
- execution 层动作扩张

## 4. 任务拆解

### Task 1 - narrow runtime helper

- 新增窄的 readout 查询入口
- 避免为了 readout 依赖重型 runtime overview 输入

### Task 2 - dashboard wiring

- `features/dashboard/page-loader.ts` 接共享 readout
- `goal-driven-home-surface.tsx` 用 `primaryGap` 更新首屏四类信息

### Task 3 - reports wiring

- `app/(workspace)/reports/page.tsx` 接共享 readout
- `reports-client.tsx` 用 `primaryGap` 更新首屏四类信息

### Task 4 - docs and validation

- baseline
- plan
- report
- `README / docs/README / PLANS`
- `self-check / boundary-check / pilot-readiness`
- 完整验证链

## 5. 验收标准

PR105 完成时必须满足：

1. `getWorkspaceBusinessLoopGapReadout` 已成立
2. `dashboard / reports / operating` 已共享同一份 business-loop gap readout
3. 首屏仍只保留四类信息
4. 文档、guard、测试、索引齐备
5. 完整验证链全绿

## 6. 风险

### 6.1 query 回退到重型 overview

会让 readout 为了复用而扩大查询成本和边界。

### 6.2 页面重新分叉

如果页面继续手写 gap 判断，后续 surface 会再次漂移。

### 6.3 双真值

如果把 readout 误写成 canonical KPI truth，会和现有 runtime truth 形成双真值。
