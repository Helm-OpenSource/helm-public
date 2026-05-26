---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_AGGREGATION_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR104 只做一条窄的 business-loop gap aggregation。

它是：

- `operator-governance runtime summary`
- business-loop gap 的共享聚合 contract
- `/operating` 与 runtime operator panel 的统一消费层

它不是：

- schema migration
- canonical persisted object
- KPI canonicalization
- dashboard query 扩面
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

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- `PR103` 已把 `missing-kpi-link` 前置到 `/operating`，但页面仍保留了手写筛选逻辑
- 当前阶段更重要的是收口共享 runtime truth，而不是继续做散的页面特判
- 这条线直接降低首屏业务闭环缺口判断的分叉风险，优先级高于继续扩页面说明层

## 3. 范围

### In Scope

- 新增 `businessLoopGapSummary`
- 固定 business-loop gap kinds 和 primary gap priority
- 接入 `buildWorkspaceRuntimeOperatorOverview`
- 让 `/operating` 与 runtime operator panel 复用同一份 summary
- 更新 baseline / plan / report / README / docs / PLANS / guards / tests

### Out of Scope

- 新表
- persisted `OperatingGap`
- KPI schema / goal schema
- dashboard 扩面
- broader operator redesign
- execution 层动作扩张

## 4. 任务拆解

### Task 1 - contract

- 冻结 `BusinessLoopGapSummary`
- 冻结 business-loop gap kinds
- 冻结 primary gap priority

### Task 2 - runtime wiring

- 接入 `buildWorkspaceRuntimeOperatorOverview`
- 补齐 runtime overview tests

### Task 3 - surface wiring

- `/operating` 改为消费共享 summary
- runtime operator panel 展示 business-loop gap posture
- 保持四类首屏 contract 不变

### Task 4 - docs and validation

- baseline
- plan
- report
- `README / docs/README / PLANS`
- `self-check / boundary-check / pilot-readiness`
- 完整验证链

## 5. 验收标准

PR104 完成时必须满足：

1. `businessLoopGapSummary` 已进入 runtime contract
2. business-loop gap kinds 已有固定边界
3. `/operating` 与 runtime operator panel 已复用同一份 summary
4. 首屏仍然只保留四类信息
5. 文档、guard、测试、索引齐备
6. 完整验证链全绿

## 6. 风险

### 6.1 非业务闭环 gap 被错误纳入

会让 operator 第一眼看到的不是主业务闭环问题。

### 6.2 页面重新分叉

如果消费层绕过共享 summary 继续手写筛选逻辑，后续页面会再次漂移。

### 6.3 双真值

如果把 runtime summary 误写成 canonical KPI truth，会和现有 runtime truth 形成双真值。
