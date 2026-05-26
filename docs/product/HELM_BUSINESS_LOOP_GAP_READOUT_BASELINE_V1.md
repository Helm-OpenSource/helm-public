---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 一句话定义

PR105 把共享 `businessLoopGapSummary` 从 `/operating` 扩到 `dashboard` 与 `reports`，让主业务闭环缺口在更多 operator-heavy surface 上都以前置、统一、可复用的方式出现。

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

## 3. 当前已成立 truth

- 共享 `getWorkspaceBusinessLoopGapReadout` 窄查询入口已成立
- `buildWorkspaceBusinessLoopGapReadout` 已能在不依赖重型 runtime overview 的前提下复用同一套 gap 聚合规则
- `dashboard` 已消费 `businessLoopGapSummary.primaryGap`
- `reports` 已消费 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / operating` 这三处现在复用同一份主业务闭环 gap 读取口径
- 首屏仍只保留：
  - `对象状态`
  - `阻塞`
  - `待决策`
  - `下一步动作`

## 4. 已成形但仍需下一层

- 当前仍是 runtime readout，不是 canonical persisted `OperatingGap`
- 当前没有 dashboard 级 analytics refactor
- 当前 primary gap priority 仍是 contract-level 默认值，不是线上校准值
- 当前还没有更广的 business-loop gap registry

## 5. 刻意未做

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard analytics refactor
- broader operator redesign
- execution-authority expansion

## 6. 风险项

- 如果后续页面绕过共享 readout 再次手写 gap 判断，页面分叉会回弹
- 如果把这层 readout 误解成 canonical KPI truth，会形成双真值
- 当前窄查询入口只适合主业务闭环 gap readout，不适合被顺手扩成新的 operator overview

## 7. 边界

这轮明确是：

- `operator-governance readout`
- shared business-loop gap readout
- not a schema migration
- not a canonical persisted object
- not a dashboard analytics refactor
- not a new execution plane

## 8. 当前阶段完成定义

这轮算完成，不看“多了多少页面”，只看：

1. `dashboard / reports / operating` 是否复用同一份 business-loop gap readout
2. 页面首屏是否继续只保留四类信息
3. query 层是否保持窄做，没有为了 readout 回退到重型 overview 依赖
4. 没有把这轮顺手扩成 schema、analytics 或 execution 改造
