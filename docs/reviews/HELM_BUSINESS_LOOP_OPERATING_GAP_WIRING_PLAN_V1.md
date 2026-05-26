---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR103 只做一条窄的 business-loop gap wiring。

它是：

- `operator-governance projection`
- business-loop gap kind
- `/operating` 首屏的最小前置缺口层

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

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- `OperatingGap` 已在 PR102 成立，但还缺业务闭环级缺口
- 当前阶段最关键的问题不是再扩页面，而是让 operator 第一眼看到经营闭环是否缺 KPI 链
- 这条线直接服务 `first real business loop`，优先级高于继续做 explanation-first 页面扩面

## 3. 范围

### In Scope

- 在 `OperatingGap` 新增 `missing-kpi-link`
- 只从现有 `CoordinationMetricsDaily` 建投影
- 缺少或 stale metrics snapshot 都进入统一 gap queue
- 把 gap 接到 `buildWorkspaceRuntimeOperatorOverview`
- 把 gap 前置到 `/operating` 的 business-first summary
- 更新 baseline / plan / report / README / docs / PLANS / guards / tests

### Out of Scope

- 新表
- persisted `OperatingGap`
- KPI schema / goal schema
- dashboard query 扩面
- broader operator redesign
- execution 层动作扩张

## 4. 任务拆解

### Task 1 - docs freeze

- baseline
- plan
- report
- `README / docs/README / PLANS`

### Task 2 - business-loop gap contract

- 新增 `missing-kpi-link`
- 冻结 missing / stale metrics snapshot 的映射规则
- 保持 `OperatingGap` 仍然只是 projection

### Task 3 - runtime and surface wiring

- 接入 `buildWorkspaceRuntimeOperatorOverview`
- 接到 `/operating` business-first summary
- 保持四类首屏 contract 不变

### Task 4 - guards and validation

- `self-check`
- `boundary-check`
- `pilot-readiness`
- 全验证链

## 5. 验收标准

PR103 完成时必须满足：

1. `missing-kpi-link` 已进入 `OperatingGap` contract
2. 缺少 / stale `CoordinationMetricsDaily` 都能投影成 gap
3. `/operating` 首屏会优先显示 business-loop gap
4. 首屏仍然只保留四类信息
5. 文档、guard、测试、索引齐备
6. 完整验证链全绿

## 6. 风险

### 6.1 stale 阈值过宽

会让 KPI 缺口被低估。

### 6.2 stale 阈值过窄

会让 operator queue 产生过多噪音。

### 6.3 双真值

如果把 projection 误写成 canonical KPI truth，会和现有 runtime truth 形成双真值。
