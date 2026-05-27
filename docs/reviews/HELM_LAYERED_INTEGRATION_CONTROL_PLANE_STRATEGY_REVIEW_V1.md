---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Layered Integration / Control Plane Strategy Review V1

## 1. 目的

这份文档把一条重要的外部战略建议收成 Helm current-main 可以接受的版本：

- 对象与业务数据层可借外部系统
- 执行与编排层可借外部引擎
- AI workflow / model 调用层可借外部能力
- 但 Helm 必须继续保留 `judgement-first`、`decision-first`、`review-before-commitment`、`recommendation != commitment`、`object-centered`、`memory-backed`、`policy-guarded` 这条 control plane

它回答 5 件事：

1. 这条战略建议哪些部分成立
2. 哪些部分必须改写后才能吸收
3. Helm 应该把哪几层继续保留为第一方能力
4. 这条线如何落实到产品结构、contract 和 POC
5. 为什么它当前只能作为 discovery track，而不能替代正在执行的 homepage / dashboard / feedback / activation 主线

## 2. 输入与判断依据

本轮 review 的输入包括：

- 用户提出的三层建议：`Twenty / Corteza / NocoBase`、`n8n / Windmill`、`Dify / Plane`
- 当前产品原则与优先级映射
- 当前 v2 合同文档、四层控制面文档与 runtime contract 文档
- 当前 recommendation / commitment 边界

本轮直接参考的 current-main truth 包括：

- [AGENTS.md](../../AGENTS.md)
- [README.md](../../README.md)
- [HELM_PRODUCT_PRINCIPLES_V1.md](../product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [HELM_PRODUCT_PRIORITY_MAPPING_V1.md](../product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md](../product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md)
- [HELM_V2_FOUNDATION_PRD_V1.md](../product/HELM_V2_FOUNDATION_PRD_V1.md)
- [HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md](../product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md)
- [HELM_V2_DATA_MODEL_V1.md](../product/HELM_V2_DATA_MODEL_V1.md)
- [HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md](../product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md)

判断基线不变：

- Helm 当前不是 CRM / ERP / project management platform
- Helm 当前不是完整 workflow / orchestration platform
- Helm 当前不是完整 auto-execution plane
- Helm 当前仍然以 `recommendation / review / write-back / memory` 为主线

## 3. 结论

这条战略方向总体成立，但必须改写成下面这句话：

**Helm 不是把三层平台打包成一个壳，而是把外部 source / execution / model capability 收到自己之上的 judgement control plane。**

更具体地说：

- 可以直接吸收：`不重复发明 CRM / workflow engine / generic AI builder`
- 需要改写后吸收：`Helm 是智能决策控制层，而不是 all-in-one 平台`
- 当前不建议采纳：`现在就绑定具体厂商`、`三层并行 POC`、`把 judgement runtime 外包`

## 4. 可以直接吸收的部分

### 4.1 Helm 不该重复发明所有底层系统

这条建议成立。

如果某些层已经有成熟系统承担：

- 业务对象持久化
- 外部系统同步
- 低层编排
- 任务执行
- 模型路由或 prompt pipeline

Helm 没必要为了“全栈完整感”把这些全部重做一遍。

### 4.2 Helm 的差异化应继续放在 judgement / memory / governance

这条建议和 current-main truth 一致。

Helm 现有最独特的部分不是：

- 又一个对象数据库
- 又一个流程编辑器
- 又一个通用 LLM workflow builder

而是：

- 把分散信号收成经营判断
- 把建议、边界、依据和拍板合同收清楚
- 把执行结果重新收回 memory / audit / replay

### 4.3 集成后的体验必须优于分开用工具

这条建议也成立。

如果用户最终仍然需要在多个工具之间自己拼：

- 事实来源
- 建议
- 审批
- 执行
- 回执

那 Helm 就只剩薄壳价值。

## 5. 需要改写后吸收的部分

### 5.1 Helm 不是 “全功能平台”，而是 judgement control plane

这条建议最关键，但措辞必须收紧。

更准确的说法不是：

- Helm 统一了数据层、执行层、AI 层

而是：

- Helm 统一了跨层判断、正式复核、受控写入、回执与经营记忆

也就是说，Helm 不是“承包所有层”，而是“控制关键判断和正式边界”。

### 5.2 数据层与执行层可以更多外接，但 judgement runtime 不能空心化

这条建议必须明确一条红线：

- `数据层` 可以更外接
- `执行层` 可以更外接
- `模型调用` 可以部分借外部
- 但 `Judgement + Memory + Review + Policy + Reconciliation` 不能外包成纯第三方 runtime

否则 Helm 很容易退化成：

- 多工具 launcher
- workflow shell
- AI builder 皮肤层

### 5.3 先定 contract，不先定厂商

当前不建议把下面这些名字直接写成产品 truth：

- `Twenty`
- `Corteza`
- `NocoBase`
- `n8n`
- `Windmill`
- `Dify`
- `Plane`

这些系统当前更适合作为：

- 候选 adapter / engine
- POC 评估对象
- contract fit 验证样本

而不是当前 repo 的正式绑定路线。

## 6. Helm 应保留的第一方能力

### 6.1 System of Record / Source Adapters 之上，Helm 只取投影，不抢主所有权

对 CRM、邮件、日历、表单、导入系统，Helm 更适合承担：

- source adapter
- object projection
- evidence linkage
- cross-source summary

当前不适合承担：

- 替代原系统成为 canonical store
- 在没有证明前成为全对象 owner

### 6.2 Judgement + Memory Layer 必须是 Helm 第一方

这层必须继续由 Helm 掌控：

- 当前判断
- blocker
- next move
- decision request
- memory write-back
- cross-meeting / cross-email / cross-object operating memory

这一层如果交给通用 AI workflow，将直接削弱 Helm 的 product truth。

### 6.3 Review + Governance Layer 必须是 Helm 第一方

所有高风险动作都应先进入 Helm 的 review bundle，而不是直接在外部执行层里隐式触发。

Helm 必须继续前置：

- Helm 建议
- 你的决策
- 当前边界
- 当前依据
- manual fallback
- audit trace

### 6.4 Execution Adapter Layer 可以外接，但不能绕过 Helm

执行引擎可以是外部系统，但前提是：

- Helm 已形成 `ActionIntent`
- Helm 已完成 `ReviewBundle`
- 高风险动作已明确人工复核
- 执行后的 `receipt / exception / reconciliation` 回到 Helm

### 6.5 Model / AI Workflow Assist Layer 只能作为辅助，不是主脑

外部 model router、LLM workflow 工具、AI pipeline 可以帮助：

- prompt orchestration
- draft generation
- low-level model routing
- tool invocation substrate

但当前不应成为：

- Helm judgement 的唯一来源
- Helm review posture 的唯一实现层
- Helm memory write-back 的 authority owner

## 7. 建议的分层模型

### 7.1 Source Layer

可接：

- CRM
- calendar
- email
- import source
- operator-maintained business system

Helm 负责：

- adapter seam
- object projection
- evidence linkage
- cross-source summary

### 7.2 Judgement + Memory Layer

Helm 负责：

- object-centered understanding
- decision-first summarization
- blocker / next-step formation
- memory-backed recommendation
- cross-source reconciliation

### 7.3 Review + Governance Layer

Helm 负责：

- recommendation != commitment
- review-before-commitment
- policy-guarded write decision
- approval posture
- audit / replay / dependency note

### 7.4 Execution Adapter Layer

外部系统可负责：

- low-level job execution
- scheduling
- retries
- workflow plumbing

Helm 负责：

- 何时值得执行
- 什么动作需要 review
- 允许什么级别的 write
- receipt 如何回流

## 8. 建议先冻结的 contract

在讨论任何具体厂商前，建议先冻结 6 个 contract：

1. `SourceAdapter`
   - 描述外部 source 的读取、增量同步、workspace/tenant mapping、evidence reference
2. `ObjectProjection`
   - 描述 Helm 如何把外部对象压成经营对象视图，而不是复制整个 schema
3. `ActionIntent`
   - 描述 Helm 已形成的下一步动作候选，但仍未 commit
4. `ReviewBundle`
   - 描述建议、风险、边界、依据、审批要求与 manual fallback
5. `ExecutionReceipt`
   - 描述外部执行结果、状态、失败、异常与回执
6. `ReconciliationResult`
   - 描述执行后 Helm 如何更新 memory / object state / evidence chain

没有这 6 个 contract，后续任何 vendor 接入都容易滑向 point integration 堆叠。

## 9. 如何落实到产品里

### 9.1 首页

首页不讲“我们整合了很多底层工具”，而应讲：

- Helm 把分散信号收成下一步
- Helm 先给建议、依据和边界
- 最终关键动作仍然需要你拍板

### 9.2 Dashboard

dashboard 第一屏前置：

- Top 3 judgement
- Top 3 blockers
- Top 3 decisions waiting
- 当前证据和边界

而不是前置：

- 底层系统清单
- integration 数量
- workflow builder 复杂度

### 9.3 Approvals / Review

所有跨系统写动作都应该收进统一 review surface。

这里是 Helm 和外部执行引擎真正分界的地方。

### 9.4 Connectors / Settings

每条连接器都应明确声明当前 posture：

- `read-only`
- `draft-only`
- `guarded write`
- `limited auto`

避免让用户误解为“连接上就等于 Helm 拥有完全执行权”。

### 9.5 Memory / Reports

执行后结果必须回 Helm，形成：

- receipt
- exception
- follow-through
- replayable memory

否则 Helm 只会有建议，没有经营闭环。

## 10. 分阶段落地建议

### Phase 0 - Strategy Freeze

- 状态：Completed
- 交付：
  - 本 review 文档
  - `PLANS.md` discovery track

### Phase 1 - Contract Freeze

- 定义 `SourceAdapter / ObjectProjection / ActionIntent / ReviewBundle / ExecutionReceipt / ReconciliationResult`
- 明确第一方 ownership 与 adapter seam
- 不做厂商绑定
- 状态：Next

### Phase 2 - Single-loop POC Definition

- 只选择一条窄闭环：
  - `meeting/email/CRM signal -> Helm judgement -> human review -> external execution -> receipt -> memory write-back`
- 明确 rollback、manual fallback 与审计要求
- 状态：Planned

### Phase 3 - One Source + One Execution Candidate Evaluation

- 只评估 `1 个 source candidate + 1 个 execution candidate`
- 按 contract fit、tenant isolation、audit、rollback、write boundary 评估
- 不并行开三层 POC
- 状态：Planned

### Phase 4 - Guarded Execution Spike

- 在单闭环上验证 execution receipt / reconciliation
- 继续保留 review-first posture
- 不把 spike 写成 platform completion
- 状态：Deferred

## 11. 当前不做

- 不把具体厂商写成 current-main official path
- 不并行推进 data layer / execution layer / AI workflow 三层 POC
- 不把 Helm 改写成 generic AI builder
- 不把 judgement runtime 外包给第三方
- 不让外部执行引擎绕过 Helm review
- 不把 adapter 接线误写成 canonical object ownership
- 不把当前 discovery 说成“技术复杂度已解决”

## 12. 风险

1. Helm 退化成外部工具的薄壳
2. 外部执行绕过 Helm 审批，破坏 `review-before-commitment`
3. Source of truth 与 Helm memory 出现双真相
4. Connector / adapter 先扩复杂度，反而拖慢 PMF 收敛
5. 为了“统一平台”叙事而再次滑向 workflow / orchestration platform

## 13. 下一步建议

接下来更合理的动作顺序是：

1. 保持当前主线优先级不变：homepage / dashboard / feedback / activation
2. 把这条线单列为 discovery track，而不是插队成当前主线
3. 先写 contract，再决定是否需要 POC
4. 如果进入 POC，也只做一条闭环，不并行造三层能力
5. 等 homepage / dashboard / activation 第一轮落地后，再决定 adapter evaluation 的实际时机

当前下一版 plan 文档见：

- [HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md](./HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md)

## 14. 验证

本轮交付物是文档，不涉及运行时行为改动。

建议验证仍然保持仓库统一链路：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

实际本轮命令执行结果以本次任务的最终交付说明为准。
