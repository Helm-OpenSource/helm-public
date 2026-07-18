---
status: active / reference-runbook
owner: helm-core
created: 2026-07-18
review_after: 2026-08-18
public_safety: Public-safe reference runbook. Use synthetic data unless a separately governed private deployment authorizes real sources.
---

# Helm Stage 1 一把手经营闭环 Runbook

> **语言 / Language**：中文主文本 + English reference

## 1. 用途与边界

本 Runbook 用于验证 Helm Public Core 的 Stage 1 参考闭环：授权、只读观察、决策、派工、
执行回执、独立验收、结果评估和候选记忆。

默认只允许 public-safe 合成数据。真实客户来源、凭据、政策和部署必须在私有 Overlay 与
Control Plane 中另行授权。运行本 Runbook 不会授权自动外发、自动承诺或生产写入。

## 2. 角色

| 角色           | 职责                                   | 禁止事项                     |
| -------------- | -------------------------------------- | ---------------------------- |
| 一把手 / OWNER | 授权观察、确认决策、确定治理边界       | 不以总授权替代逐类动作授权   |
| 来源 owner     | 确认只读访问、时效 SLA、撤销与保留规则 | 不把原始凭据写入 Core 数据库 |
| 执行者         | 按 Work Packet 执行并提交结构化回执    | 不验收自己的高风险任务       |
| 验收者         | 核对结果和证据，确认或拒绝回执         | 不以“已处理”自由文本代替证据 |
| FDE / Builder  | 配置、排障、补契约与评测               | 不绕过 owner gate 或部署授权 |

## 3. 前置条件

- 使用独立开发工作区或 public-safe 合成工作区。
- 数据库 schema 已应用 `20260718080000_stage1_owner_loop` 迁移。
- 工作区有一个真实 `WorkspaceRole.OWNER` 用户。
- 所有来源均能以只读方式访问，凭据只保存于密钥管理器。
- 明确执行者与验收者，尤其是高风险事项。
- 不使用真实客户名、人员数据、私有域名、内网地址或生产凭据作为测试数据。

## 4. 验证顺序

### 4.1 静态与单元验证

```bash
npm run check:stage1-owner-loop
npm run typecheck
npm run check:boundaries
```

专项门只证明仓库中的契约、持久化、Dashboard 接入、测试和文档引用保持一致；它不是
生产连接器、客户部署或发布批准。

### 4.2 隔离数据库验证

必须使用一次性空库；不得重置共享数据库或生产数据库。

```bash
DATABASE_URL='<isolated-empty-database-url>' npx tsx prisma/setup-db.ts prepare
DATABASE_URL='<isolated-empty-database-url>' npm run test -- --run lib/stage1-owner-loop/stage1-owner-loop.mysql.test.ts
```

验收：所有迁移可从空库重放，并发用例只能生成一个授权运行、一个 Work Packet、一个
有效验收结果和一个候选记忆。

## 5. 运行流程

### 5.1 建立观察授权计划

调用 `createEnterpriseObservationProgram`，提交：

- 工作区、目的、范围和数据类别。
- 开始、失效时间与保留天数。
- 授权引用。
- actor 身份和审计说明。

检查：计划初始为 `DRAFT`，期限、保留范围和引用均有效。

### 5.2 激活计划

由 OWNER 调用 `activateEnterpriseObservationProgram`。激活前复核：

- 授权仍有效。
- 目的和范围没有扩大。
- 撤销路径和保留规则可执行。
- 来源访问模式均为只读。

### 5.3 登记来源

调用 `registerObservationSource`。`secretRef` 必须是密钥管理器引用，不得传原始密钥。

每个来源至少定义：

- 稳定的 `sourceKey` 和来源类别。
- access mode。
- 来源 owner。
- freshness SLA。
- sensitivity 和 retention。
- 与计划一致的 authorization reference。

并发登记相同来源必须幂等；内容不同则返回冲突，而不是覆盖旧登记。

### 5.4 开始和完成观察

调用 `beginObservationSourceRun` 时传入非空、规范化的 `executionKey`。运行开始会原子认领
当前授权版本。计划被撤销或过期后，开始新运行必须失败。

调用 `completeObservationSourceRun` 时提交：

- `observedAt` 和观察窗口。
- `summaryHash`。
- completeness 和 freshness。
- success / partial / failure / unknown。
- evidence refs 与结构化错误代码。

终态运行不可被重试覆盖。相同内容重放幂等，不同内容必须冲突。

### 5.5 形成证据化决策

先构造符合 `DecisionObject` 的输入，再调用 `recordStage1DecisionRecord`。最低门槛：

- 至少一个 knowledge ref 和 evidence ref。
- facts / inferences / unknowns 分离。
- 备选方案、风险、owner gate 和回滚路径明确。
- `allowedActionLevel` 不能超过证据校验结果。

证据不足时保留 `DRAFT`；满足门槛才进入 `EVIDENCE_READY`。

### 5.6 一把手确认

OWNER 调用 `confirmStage1DecisionRecord` 并提交明确结论。检查：

- 决策没有过期。
- owner 身份真实且具备治理权限。
- 结论非空。
- 并发确认只保留一个有效状态转移。

### 5.7 派发 Work Packet

构造 `OwnerCommandDraft`，调用 `dispatchStage1DecisionWorkPacket`。AI 可以预填字段，但
OWNER 至少要核对 owner 和验收标准。

检查：

- decision ref 与工作区一致。
- 截止时间、失效条件、证据要求和升级 owner 明确。
- 工具与外部副作用是封闭列表。
- Public 默认 review-first，不带自动外部执行。
- 同一决策并发派发只生成一个 `DecisionWorkPacketClaim` 和 ActionItem。

### 5.8 执行、拒绝或阻断

继续使用治理动作链：

- 执行：`executeActionItem`
- 拒绝：`rejectApprovalTask`，必须有结构化拒绝原因
- 阻断：`blockApprovedAction`

关闭动作会生成 `ExecutionReceipt`。如果回执写入失败，必须保留可诊断错误，不能把任务
展示为已形成可信结果。

### 5.9 独立验收

非执行者调用回执验收入口。高风险任务执行者与验收者必须分离。验收绑定最新回执内容；
回执变化后旧验收不再代表最新内容已验证。

检查：

- `verificationState=VERIFIED`
- `verifiedByUserId` 非空且不同于执行者
- evidence refs 可访问且与结果一致
- quality flags 没有被忽略

### 5.10 结果评估与记忆回流

调用 `evaluateStage1DecisionOutcome`，提交业务结果和 `outcomeRef`。

成功标准：同一事务内出现：

1. DecisionRecord 变为 `EVALUATED`。
2. 一个 `OBSERVED` MemoryFact 候选。
3. 一条审计记录。

候选记忆不能自动晋升，也不能自动调整激励、政策或自动化等级。

## 6. Dashboard 验收

以 OWNER 登录 `/dashboard`：

- 可见“一把手经营闭环”。
- 来源健康按各自 freshness SLA 显示。
- 决策状态来自 DecisionRecord + Work Packet + ActionItem + Receipt 的确定性投影。
- 严重监督信号和缺失回执触发 attention posture。
- 页面明确“不执行、不外发、不产生承诺”。

以非 OWNER 登录：

- Stage 1 聚合查询在访问数据库前返回 `null`。
- 页面不渲染一把手经营闭环。

## 7. 故障处理

| 故障           | 处理                                     | 禁止                                  |
| -------------- | ---------------------------------------- | ------------------------------------- |
| 授权过期或撤销 | 停止新观察，保留历史回执                 | 不延长时间绕过重新授权                |
| 来源 stale     | 标记过时，降低回答置信度，通知来源 owner | 不用旧数据给高置信建议                |
| 来源 ERROR     | 保留错误代码，进入监督异常               | 不把连接失败记为无变化                |
| 证据冲突       | 同时展示冲突来源，要求 owner 判断        | 不静默选择更符合建议的来源            |
| 决策过期       | 标记 EXPIRED，重新收集证据               | 不复用旧 owner 结论                   |
| 并发派工冲突   | 读取唯一 claim，比较内容                 | 不创建第二条有效任务                  |
| 缺执行回执     | 标记 RECEIPT_MISSING，阻止结果学习       | 不以 ActionItem=EXECUTED 代替业务结果 |
| 自验收         | 拒绝并审计                               | 不降低高风险职责分离门                |
| 评估冲突       | 保留第一份原子评估，要求人工复核         | 不覆盖已有候选记忆                    |

## 8. 撤销与回滚

### 授权撤销

调用 `revokeEnterpriseObservationProgram`，记录撤销人、原因和时间。撤销后新运行必须
fail closed；已完成回执不重写。

### 应用回滚

- Dashboard 读侧可独立回滚，不改变持久化真值。
- 新表和字段为增量迁移；回滚应用时保留数据，除非 owner 单独批准数据迁移。
- 不修改已签名、已哈希或已验收历史回执。

## 9. 最终验收清单

- [ ] OWNER 授权有目的、范围、期限、保留和撤销路径。
- [ ] 所有来源为只读模式且只保存 secret reference。
- [ ] 撤销与新运行竞态只有一个赢家。
- [ ] 过期、冲突和无证据问题降级或拒答。
- [ ] 并发确认只产生一个 Work Packet。
- [ ] 高风险执行者不能验收自己的回执。
- [ ] REJECTED / BLOCKED / EXPIRED 有结构化原因或条件。
- [ ] 没有回执时不宣称完成。
- [ ] 评估只写 `OBSERVED` 候选记忆。
- [ ] Public 默认没有自动外部副作用。
- [ ] 非 OWNER 无法读取 CEO 聚合。
- [ ] `docs/STATUS.md` 没有提前宣称生产成立。

## English Reference

Run this reference flow only in an isolated, public-safe workspace unless a
private deployment separately authorizes real sources. The sequence is owner
authorization, read-only source observation, evidence-bound decision, owner
confirmation, governed work packet, structured receipt, independent
verification, decision evaluation, and candidate-memory backflow. Revocation,
missing evidence, cross-workspace references, self-verification, and absent
external receipts fail closed. This runbook does not authorize production
connectors or autonomous external actions.
