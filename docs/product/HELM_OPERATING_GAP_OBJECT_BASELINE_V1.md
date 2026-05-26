---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_OPERATING_GAP_OBJECT_BASELINE_V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 一句话定义

`OperatingGap` 是 Helm 当前阶段在 `operator-governance` 层的统一缺口对象投影，用来把 `TruthConflict / ProblemSpace / CompositionFailure` 收成一条更稳定、可排序、可升级的缺口队列。

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`

本轮接到的真实业务闭环：

- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

## 3. 当前已成立 truth

- `OperatingGap` 作为 `operator-governance projection` 已成立
- 当前投影来源固定为：
  - `TruthConflict`
  - `ProblemSpace`
  - `CompositionFailure`
- 当前已成立的 gap kinds 只有：
  - `unresolved-conflict`
  - `missing-owner`
  - `missing-next-action`
  - `missing-evidence`
  - `source-not-connected`
  - `blocked-too-long`
  - `capability-gap`
- 当前 `RuntimeOperatorPanel` 会把这些缺口作为统一 queue 展示
- 当前支持把 `PR101` 的 unresolved reconciliation result 包成同一类 `OperatingGap` contract

## 4. 已成形但仍需下一层

- `OperatingGap` 还不是 canonical persisted object
- 当前仍没有单独的 `OperatingGap` Prisma table
- `missing KPI link` 还没有进入这轮 established truth
- 当前 queue 仍主要来自 runtime truth projection，不是完整业务闭环级 gap registry
- 还没有把 `OperatingGap` 直接接到更多 operator-heavy surface

## 5. 刻意未做

- schema migration
- canonical persisted `OperatingGap` object
- new runtime orchestration plane
- ontology platform
- execution-authority expansion
- broader UI redesign

## 6. 风险项

- projection 规则如果写得过宽，会把临时波动误读成长期 gap
- projection 规则如果写得过窄，会漏掉需要 operator 立刻处理的缺口
- 如果把 projection 误写成 canonical persisted object，会制造双真值

## 7. 边界

这轮明确是：

- `operator-governance projection`
- not a schema migration
- not a canonical persisted object
- not a new runtime orchestration plane
- not a new execution plane

## 8. 当前阶段完成定义

这轮算完成，不看“多了一个新对象名词”，只看：

1. `TruthConflict / ProblemSpace / CompositionFailure` 是否被稳定收口到一条 `OperatingGap` queue
2. operator 是否能直接看到对象状态、阻塞、待决策、下一步动作
3. unresolved posture 是否保持诚实
4. 没有把这轮顺手扩成 schema/platform/execution 改造
