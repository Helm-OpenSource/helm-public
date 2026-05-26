---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR101 只做一条窄的 truth reconciliation engine。

固定输入：

- `meeting`
- `email`
- `crm`
- `report`

固定输出：

- `resolved`
- `unresolved`
- `confidence`
- `evidence chain`
- `operator review required`

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`

本轮接到的真实业务闭环：

- 第一条真实业务闭环
- `meeting / email / CRM / report -> belief update -> operator review -> committed action`

本轮服务的角色：

- 决策
- 审计
- 复盘

本轮为什么现在做：

- 它直接降低多来源输入进入同一经营闭环时的 truth fork 风险
- 它符合“证据链优先于演示效果”和“真实业务闭环优先于功能扩面”
- 它是 `PR100` 之后最小、最可验证的下一层，不需要先做平台抽象

## 3. 范围

### In Scope

- 冻结 `meeting / email / CRM / report` 四类 signal source
- 建立 workspace-scoped subject contract
- 建立分数与收敛规则
- 建立 `resolved / unresolved / confidence / evidence / review required` 固定输出
- 补 baseline / plan / report / README / docs / PLANS / guards / tests

### Out of Scope

- schema migration
- canonical `Belief / Goal / OperatingGap` 新表
- 把结果直接写入 `TruthConflict / WorldModelSnapshot / ProblemSpace`
- operator UI surface
- ontology platform
- connector platformization
- execution-authority expansion

## 4. 任务拆解

### Task 1 - freeze docs

- 新增 baseline
- 新增 plan
- 新增 report
- 更新 `README / docs/README / PLANS`

### Task 2 - minimum engine

- 新增 `lib/operating-system/truth-reconciliation.ts`
- 冻结 source kinds、subject contract、evidence chain 结构
- 冻结收敛与 review required 规则

### Task 3 - tests and guards

- 新增 `truth-reconciliation.test.ts`
- 更新 `index.ts`
- 更新 `self-check / boundary-check / pilot-readiness`

## 5. 验收标准

PR101 完成时必须满足：

1. 四类输入被明确限制在 `meeting / email / CRM / report`
2. 输出固定为 `resolved / unresolved / confidence / evidence / review required`
3. engine 保持 workspace-scoped，不做跨 workspace truth 混合
4. 不引入 schema migration / ontology platform / execution 扩权
5. baseline / plan / report / README / docs / guards / tests 齐备
6. 完整验证链全绿

## 6. 风险

### 6.1 收敛规则过强

会把 operator 仍应 review 的冲突误写成 resolved。

### 6.2 engine 变成新平台入口

如果顺手加 persistence、UI、connector runtime 扩面，这轮会直接越界。

### 6.3 claim scope 漂移

如果同一次 reconciliation quietly 混入不同 `claimKey` 或不同对象，就会破坏 evidence chain。

## 7. 本轮完成定义

本轮完成，不看“功能名词有多高级”，只看：

- 四类输入是否被收窄
- 五类输出是否被固定
- evidence chain 是否可解释
- operator review required 是否诚实保留
