---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 一句话定义

PR103 把 `missing-kpi-link` 收成一条业务闭环级 `OperatingGap`，让 `/operating` 首屏在 KPI 链没有接上时，优先显示这条缺口，而不是继续把经营闭环断点藏在解释性内容之后。

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

## 3. 当前已成立 truth

- `missing-kpi-link` 已作为 `OperatingGap` 的 business-loop gap kind 成立
- 当前只复用现有 `CoordinationMetricsDaily` truth，不新建 KPI schema
- 当前会把两种 posture 投影成同一类 gap：
  - 缺少 metrics snapshot
  - metrics snapshot stale
- `buildWorkspaceRuntimeOperatorOverview` 已会把这条 gap 收进统一 `operatingGaps`
- `/operating` 首屏已会优先把这条 gap 放进：
  - `阻塞`
  - `待决策`
  - `下一步动作`
- `BusinessFirstSurfaceSummary` 的四类首屏 contract 继续保持不变

## 4. 已成形但仍需下一层

- 当前只是 runtime/operator projection，不是 canonical persisted object
- 当前还没有 canonical KPI object
- 当前还没有 dashboard 级的 business-loop gap readout
- 当前还没有 broader business-loop gap registry

## 5. 刻意未做

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard query 扩面
- ontology platform
- execution-authority expansion

## 6. 风险项

- 如果 stale threshold 过宽，会把短期更新延迟误读成业务闭环缺口
- 如果 stale threshold 过窄，会让 operator queue 产生不必要噪音
- 如果把这层 projection 误写成 canonical KPI truth，会制造双真值

## 7. 边界

这轮明确是：

- `operator-governance projection`
- business-loop gap wiring
- not a schema migration
- not a canonical persisted object
- not a dashboard expansion
- not a new execution plane

## 8. 当前阶段完成定义

这轮算完成，不看“多了一个 KPI 名词”，只看：

1. 业务闭环缺口是否能在 `/operating` 首屏第一时间被看到
2. `missing / stale metrics snapshot` 是否都能进入统一 `OperatingGap` queue
3. 首屏仍然只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`
4. 没有把这轮顺手扩成 schema/platform/execution 改造
