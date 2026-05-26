---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 一句话定义

PR106 把共享 `businessLoopGapSummary` 继续扩到 `inbox` 与 `diagnostics`，让更多 operator-heavy surface 用同一份主业务闭环缺口读数前置当前最该处理的问题。

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

## 3. 当前已成立 truth

- `inbox` 已消费 `businessLoopGapSummary.primaryGap`
- `diagnostics` 已消费 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / inbox / diagnostics / operating` 已共享同一份主业务闭环 gap readout contract
- 页面首屏仍只保留：
  - `对象状态`
  - `阻塞`
  - `待决策`
  - `下一步动作`

## 4. 已成形但仍需下一层

- 当前仍是 surface readout，不是 canonical persisted `OperatingGap`
- 当前没有更广的 operator surface registry
- 当前 primary gap priority 仍是 contract-level 默认值，不是线上校准值
- 当前仍没有 KPI canonicalization 或 analytics refactor

## 5. 刻意未做

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- dashboard analytics refactor
- execution-authority expansion

## 6. 风险项

- 如果后续 surface 继续手写各自的 gap 逻辑，页面分叉会再次回弹
- 如果把 shared readout 误解成 canonical KPI truth，会形成双真值
- `inbox / diagnostics` 当前只接 readout，不代表它们已经成为更广的 operator orchestration plane

## 7. 边界

这轮明确是：

- `operator-governance readout surface expansion`
- shared business-loop gap readout reuse
- not a schema migration
- not a canonical persisted object
- not a broader operator redesign
- not a new execution plane

## 8. 当前阶段完成定义

这轮算完成，不看“多了多少解释性文案”，只看：

1. `inbox / diagnostics` 是否复用共享 `businessLoopGapSummary`
2. 页面首屏是否仍只保留四类信息
3. 没有为了 surface readout 扩大 schema、analytics 或 execution 范围
4. 文档、索引、guard、回归入口都已同步
