---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 一句话定义

PR104 把 business-loop gap 从页面内联判断收口成共享 runtime summary，让 `/operating` 首屏和 runtime operator panel 复用同一份 `businessLoopGapSummary`，避免业务闭环缺口在不同页面再次分叉。

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

## 3. 当前已成立 truth

- `businessLoopGapSummary` 已作为共享 runtime contract 成立
- business-loop gap 只聚合以下 kinds：
  - `missing-kpi-link`
  - `missing-owner`
  - `missing-next-action`
  - `unresolved-conflict`
  - `missing-evidence`
- `businessLoopGapSummary.primaryGap` 已会按固定优先级选出当前最该前置的闭环缺口
- `buildWorkspaceRuntimeOperatorOverview` 已暴露共享的 `businessLoopGapSummary`
- `/operating` 首屏已不再手写查找 `missing-kpi-link`，而是消费共享 summary
- runtime operator panel 已会显示当前 business-loop gap 的 review posture

## 4. 已成形但仍需下一层

- 当前只是 runtime summary，不是 canonical persisted object
- 当前没有 dashboard 级 business-loop summary
- 当前没有更广的 business-loop gap registry
- 当前 primary gap priority 仍是 contract-level 默认排序，不是线上校准结果

## 5. 刻意未做

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard query 扩面
- ontology platform
- execution-authority expansion

## 6. 风险项

- 如果共享 summary 直接被误读成 canonical KPI truth，会形成双真值
- 如果后续页面跳过 `businessLoopGapSummary` 重新手写筛选逻辑，页面分叉会再次回弹
- 当前优先级只适合当前阶段，不代表长期最优调度

## 7. 边界

这轮明确是：

- `operator-governance runtime summary`
- business-loop gap aggregation
- not a schema migration
- not a canonical persisted object
- not a dashboard expansion
- not a new execution plane

## 8. 当前阶段完成定义

这轮算完成，不看“多了多少 gap 类型”，只看：

1. `/operating` 和 runtime operator panel 是否复用同一份 business-loop summary
2. 首屏是否继续只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`
3. 非 business-loop 的 gap 是否没有被误塞进主业务闭环 summary
4. 没有把这轮顺手扩成 schema、dashboard 或 execution 改造
