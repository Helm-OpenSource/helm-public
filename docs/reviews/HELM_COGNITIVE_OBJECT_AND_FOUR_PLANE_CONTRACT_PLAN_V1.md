---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_PLAN_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 目标

PR100 只冻结 Helm 当前阶段的：

1. 四层控制面 contract
2. 认知对象 contract
3. 当前阶段 established truth / unresolved truth
4. 后续 `PR101 ~ PR103` 的统一前置边界

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

本轮接到的真实业务闭环：

- 第一条真实业务闭环
- 会议 / 邮件 / CRM / 报表输入进入 Helm 后的事实、任务、证据、结果、复盘链

本轮服务的角色：

- 决策
- 执行
- 审计
- 复盘

本轮为什么现在做：

- 它不是新 connector、不是新平台、不是新 UI 扩面
- 它直接降低当前 P0 主线在对象命名、边界表达和后续实现上的漂移成本
- 它符合“证据链优先于演示效果”和“内部使用优先于抽象平台化”

## 3. 范围

### In Scope

- 冻结 `Source / Ingestion`
- 冻结 `Belief / Runtime`
- 冻结 `Operator / Governance`
- 冻结 `Execution / Commitment`
- 冻结 `Belief / Goal / Committed Intention / OperatingGap`
- 落最小 TS contract
- 补最小 guard
- 补 baseline / plan / report / README / docs / PLANS / tests

### Out of Scope

- schema migration
- new runtime engine
- truth reconciliation implementation
- new connector work
- WeCom / DingTalk runtime 扩面
- full ontology platform
- full BDI runtime
- execution-authority expansion

## 4. 任务拆解

### Task 1 - freeze docs

- 新增 baseline
- 新增 plan
- 新增 report
- 在索引里接入

### Task 2 - minimum code contract

- 增加共享 TS contract
- 冻结四层控制面顺序
- 冻结四类认知对象与当前映射
- 用测试把最小不变量写死

### Task 3 - minimum guards

- `self-check`
- `boundary-check`
- `pilot-readiness`

确保：

- 文档被索引
- contract 文件存在
- 关键字段没有被删掉

## 5. 验收标准

PR100 完成时必须满足：

1. baseline / plan / report 已落库
2. TS contract 已存在并有测试
3. README / docs/README / PLANS 已同步
4. self-check / boundary-check / pilot-readiness 已识别该 contract
5. 完整验证链全绿

## 6. 风险

### 6.1 过度平台化

如果把这轮写成 ontology runtime 或新平台，就会直接偏离当前阶段优先级。

### 6.2 命名先于闭环

如果只做新术语，不接当前对象与证据链，收益会很低。

### 6.3 过早迁移 schema

如果直接引入新表，范围会大于本轮需要。

## 7. 本轮完成定义

本轮完成，不看功能数量，而看：

- 后续主线是否获得统一对象边界
- 当前 truth 是否被诚实表达
- 后续实现是否不再需要重复争论 “事实 / 目标 / 承诺 / 缺口 / 四层边界”
