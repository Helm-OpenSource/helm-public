---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR106 只做一条窄的 surface expansion。

它是：

- shared business-loop gap readout 的 surface reuse
- `inbox / diagnostics` 的统一 operator-governance readout
- business-first 首屏 contract 的继续收紧

它不是：

- schema migration
- canonical persisted object
- KPI canonicalization
- dashboard analytics refactor
- broader operator redesign
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
- `docs/product/HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- `PR105` 已让 `dashboard / reports` 共享同一份 `businessLoopGapSummary`
- `inbox / diagnostics` 仍在用各自页面内联判断描述主业务闭环缺口
- 当前阶段更重要的是进一步减少 operator-heavy surface 的 gap 分叉，而不是继续新增页面说明层

## 3. 范围

### In Scope

- 让 `inbox` 消费共享 `businessLoopGapSummary`
- 让 `diagnostics` 消费共享 `businessLoopGapSummary`
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

### Task 1 - surface wiring

- `app/(workspace)/inbox/page.tsx` 接共享 readout
- `features/inbox/inbox-client.tsx` 用 `primaryGap` 更新首屏四类信息
- `app/(workspace)/diagnostics/page.tsx` 接共享 readout
- `features/diagnostics/diagnostics-client.tsx` 用 `primaryGap` 更新首屏四类信息

### Task 2 - hierarchy guard

- 补共享 surface hierarchy guard
- 确保 `inbox / diagnostics` 不回退到页面内联 gap 分叉

### Task 3 - docs and validation

- baseline
- plan
- report
- `README / docs/README / PLANS`
- `self-check / boundary-check / pilot-readiness`
- 完整验证链

## 5. 验收标准

PR106 完成时必须满足：

1. `inbox / diagnostics` 已消费共享 `businessLoopGapSummary`
2. `dashboard / reports / inbox / diagnostics / operating` 已共享同一份 business-loop gap readout contract
3. 首屏仍只保留四类信息
4. 文档、guard、测试、索引齐备
5. 完整验证链全绿

## 6. 风险

### 6.1 页面重新分叉

如果后续页面重新手写 gap 判断，surface 会再次漂移。

### 6.2 双真值

如果把 readout 误读成 canonical KPI truth，会和 runtime truth 形成双真值。

### 6.3 范围膨胀

如果顺手把这轮扩成 broader operator redesign，会偏离当前阶段最小可验证改动原则。
