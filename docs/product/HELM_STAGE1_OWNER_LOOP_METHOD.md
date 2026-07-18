---
status: implemented_reference_slice
owner: helm-core
created: 2026-07-18
review_after: 2026-08-18
public_safety: Public-safe method and reference implementation boundary. It contains no customer data, connector credential, private policy, deployment approval, or production receipt.
---

# Helm Stage 1 一把手经营闭环方法 / Stage 1 Owner Operating Loop Method

> **语言 / Language**：中文主文本 + English reference summary

## 1. 结论

Helm Stage 1 的目标不是让 AI 接管企业，而是让一把手在明确授权范围内先获得一条
可信、可追溯、可撤销的经营闭环：

```text
一把手授权
→ 只读观察
→ 证据化理解
→ 决策建议
→ 一把手确认
→ 受治理派工
→ 执行回执
→ 独立验收
→ 结果评估
→ 候选记忆
```

这条链的第一性资产是**可信回执链**，不是对象数量，也不是自动化比例。没有真实、
结构化、可核验的执行结果，AI 不能据此提高置信度、修改政策或晋升自动化等级。

Stage 1 remains review-first. It creates an evidence-bound owner operating loop;
it does not grant autonomous external-action authority.

## 2. 完成口径

Stage 1 只有在下列八层同时具备代码、页面、测试、文档和可重复运行证据时，才可以
声明“完整成立”。其中任何一项只有类型、文档、合成截图或孤立页面，都必须降级为
“已成形但仍需下一层”。

| 层             | 完成条件                                           | Public Core 当前事实                                                           |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| 一把手授权     | 目的、范围、期限、数据类别、保留、撤销、审计可运行 | 已有契约、持久化、原子撤销与测试；真实客户授权仍由部署方完成                   |
| 全源观察       | 来源登记、只读模式、授权版本、运行回执、健康度     | 已有来源与运行服务、Dashboard 健康投影；具体 SaaS / 数据库连接器不在 Core      |
| 证据与真值     | 来源、时效、完整性、冲突、未知、引用               | 已有证据问答契约和观察回执；通用问答运行编排仍需下一层                         |
| Company Memory | 事实、规则、流程、决策、结果及失效机制             | 复用 `MemoryFact` / `ArtifactBundle`；评估结果只写 `OBSERVED` 候选，不自动晋升 |
| 经营世界模型   | 时间化对象关系与经营上下文                         | 复用 `TemporalOperatingContextSnapshot`；不另建第二套世界模型                  |
| 一把手交互     | 经营摘要、问答、异常解释、证据下钻                 | Dashboard 已有 OWNER-only 只读汇总；完整问答与决策操作面仍需下一层             |
| 决策与监督     | Decision Record、监督信号、升级条件                | 已有工作区级持久化、幂等写入与只读投影                                         |
| 治理执行闭环   | 确认、派工、回执、独立验收、结果学习               | 服务链与并发约束已成形；public-safe 合成交互 E2E 仍是发布前硬门                |

因此，本批次的诚实结论是：**Stage 1 公共参考切片已成形，但完整产品运行面仍需
下一层**。它不是客户生产部署或企业全源接入已经成立的证明。

## 3. 八层方法

### 3.1 一把手授权层

`EnterpriseObservationProgram` 是只读观察的授权根。每个计划必须包含：

- `purpose`：为什么观察；禁止“以后可能有用”式无限目的。
- `scopeRefs`：允许观察的组织、系统或数据范围。
- `dataCategories`：允许处理的数据类别。
- `startsAt` / `expiresAt`：明确授权窗口。
- `retentionDays`：证据和派生数据保留上限。
- `authorizationRef`：可核验的授权依据引用。
- 撤销人、撤销时间、撤销原因和审计引用。

运行服务通过数据库条件写入竞争授权。开始一次观察和撤销授权并发发生时，只允许一个
数据库赢家；撤销成功后，任何新观察立即停止。历史回执保持不可变。

一把手授权不等于获得源系统写权限。Stage 1 的来源访问模式只能是：

- `read_only_api`
- `read_only_replica`
- `scheduled_snapshot`
- `file_snapshot`

### 3.2 全源观察层

`ObservationSource` 只保存来源元数据和密钥管理器引用，不保存原始凭据。每次观察由
`ObservationSourceRun` 记录：

- 授权版本和幂等执行键。
- 观察窗口、完成时间和摘要哈希。
- 完整性、时效、结果和错误代码。
- 证据引用，不保存未经治理的原始 payload。

来源健康不是“连接成功过一次”，而是相对于各来源自己的时效 SLA 判断：

```text
healthy  = ACTIVE 且 lastObservedAt + freshnessSlaMinutes >= now
stale    = ACTIVE 但超过时效 SLA
failing  = 来源状态为 ERROR
unknown  = 尚未观察、未激活或状态不足以判断
```

### 3.3 证据与真值层

`EvidenceAnswerPacket` 必须分开：

- `facts`：可由证据直接支持的事实。
- `inferences`：基于事实的推断，不能伪装为事实。
- `unknowns`：证据未覆盖的问题。
- `conflicts`：来源之间的冲突。
- `freshness` 和 `confidence`：回答时效与置信度。
- `reviewRequired` / `refusalReason`：需要一把手复核或应拒答的理由。

过期、冲突、缺证据或越权范围必须降级回答或拒答。模型流畅度不能覆盖证据缺口。

### 3.4 Company Memory

Company Memory 继续复用现有 `MemoryFact` 与 `ArtifactBundle`，不另建平行知识库。
决策结果评估只能先形成 `MemoryStatus.OBSERVED` 候选：

- `confirmedByUser=false`
- `createdBySystem=true`
- `SourceType.SYSTEM_INFERENCE`
- `MemoryFactType.ACTION_PATTERN`

候选记忆不能自行成为正式事实，不能直接提高自动化等级，也不能触发分钱或结算。

### 3.5 经营世界模型

Stage 1 使用 `TemporalOperatingContextSnapshot` 作为时间化经营上下文。Pack 可以增加行业
对象映射，但不能要求 Core 反向依赖 Pack，也不能在 Core 建第二套客户、项目或流程真值。

关系必须携带时间与证据语义。无法确定的关系应保持未知，不以静态组织图代替真实流转。

### 3.6 一把手交互层

Dashboard 的“一把手经营闭环”只向 `WorkspaceRole.OWNER` 返回聚合数据，并展示：

- 活跃观察计划与来源健康。
- 待一把手拍板、待派发、跟进中和已复盘决策。
- 未解决监督信号及严重度。
- Work Packet 回执的已验收、自报和缺失数量。

该面板明确为只读：不执行、不外发、不产生客户承诺。审批和回执验收仍进入现有
`/approvals` 治理面；候选记忆进入 `/memory`。

### 3.7 决策与监督层

`DecisionRecord` 保存事实、推断、未知、风险、方案、owner gate 与有效期。建议只有在
证据和知识引用满足门槛后才进入 `EVIDENCE_READY`。

`SupervisionSignalRecord` 保存计划与实际偏差、责任范围、严重度、证据、升级条件和建议
路径。建议路径是封闭集合，只能进入观察、owner review、Work Packet、冻结/回滚候选或
Pack 候选；它不是直接执行命令。

### 3.8 治理执行闭环

执行继续复用 `ActionItem`、`ApprovalTask` 和 `ExecutionReceipt`。Stage 1 不复制状态机，
而是将现有对象投影为：

```text
DRAFT
→ EVIDENCE_READY
→ OWNER_CONFIRMED
→ DISPATCHED
→ IN_PROGRESS
→ RECEIPT_SUBMITTED
→ VERIFIED
→ EVALUATED

分支：REJECTED / BLOCKED / EXPIRED / SUPERSEDED / RECEIPT_MISSING
```

## 4. 首个窄闭环：决策事项督办

### 4.1 输入

输入可以来自经营信号或一把手问题，但进入闭环前必须形成：

1. 事实、推断、未知和冲突。
2. 至少一个知识引用和一个证据引用。
3. 备选方案、风险和建议方案。
4. owner gate、有效期与回滚路径。

### 4.2 一把手确认

只有真实 `USER` 身份、且具备工作区治理动作权限的人可以确认。过期决策不能确认；并发
确认依赖条件更新，不能产生两个有效结论。

### 4.3 Work Packet

由 AI 预填、人工主要确认 owner 与验收标准：

- 决策引用。
- 执行对象。
- 目标与行动。
- 截止时间。
- 验收标准。
- 证据要求。
- 失效条件。
- 阻塞升级对象。
- 自动化等级。
- 允许工具与外部副作用。

`DecisionWorkPacketClaim.decisionRecordId` 唯一约束是并发仲裁器。并发派发只能产生一个
有效 ActionItem；失败竞争者整笔事务回滚。

### 4.4 回执与验收

关闭动作时必须形成结构化 `ExecutionReceipt`。回执默认 `SELF_REPORTED`，只有非执行者
验收后才可变为 `VERIFIED`。已验证回执若内容发生变化，必须重新验收，不能静默覆盖或
降级旧真值。

没有外部系统成功回执时，不能把动作描述为“已完成”。允许的结果是成功、部分成功、
失败、未执行或拒绝，并附证据和下一步。

### 4.5 结果评估和学习回流

`evaluateStage1DecisionOutcome` 只接受：

- 工作区、决策、ActionItem、审批和回执一致。
- 业务结果已知并有 `outcomeRef`。
- 执行成功/失败类结果已有独立 `VERIFIED` 回执。
- 结构化 `REJECTED` 或 `NOT_EXECUTED` 可作为治理关闭信号回流。

评估通过后，在同一事务内完成：

1. `DecisionRecord` 条件更新为 `EVALUATED`。
2. 写一个 `OBSERVED` Company Memory 候选。
3. 写审计记录。

相同评估重放幂等；内容不同则冲突。候选记忆仍需人工治理，不能自动激活政策。

## 5. 自动化边界

Public Core 默认 `review_first`。`AutonomyPolicyEnvelope` 与
`AutonomousActionReceipt` 是公共契约，不代表任何工作区已获得自治权。

所有预授权请求必须同时满足：

- 策略处于有效状态、在有效期与允许时段内。
- 动作类别、目标、渠道、工具和模型版本均在封闭范围内。
- 金额、次数等额度未超限。
- 没有身份冲突、投诉、敏感对象、监管禁止、模型漂移或急停信号。
- 外部副作用有可核验回执和回滚引用。

未知条件按停止条件处理。缺策略、空策略引用、越界渠道或未声明金额均 fail closed。

## 6. 质量指标

Stage 1 不以“生成了多少建议”为主指标，而以以下质量指标验收：

| 指标           | 计算口径                             | 晋级意义             |
| -------------- | ------------------------------------ | -------------------- |
| 来源健康率     | healthy / registered sources         | 证据输入是否稳定     |
| 证据覆盖率     | 有有效 evidenceRef 的判断 / 全部判断 | 是否可审计           |
| 冲突显式率     | 已标注冲突 / 实际发现冲突            | 是否隐藏矛盾         |
| owner 决策时延 | EVIDENCE_READY 到确认/拒绝           | 是否真的减负         |
| 回执完整率     | 有规范回执的关闭任务 / 关闭任务      | 飞轮能否学习         |
| 独立验收率     | VERIFIED / Work Packet               | 结果是否可信         |
| 回执质量分     | VERIFIED 回执的确定性质量分          | 证据质量而非文本长度 |
| 拒绝回流率     | 有结构化原因的拒绝 / 全部拒绝        | 错误是否可学习       |
| 越界阻断率     | 被阻断越界动作 / 全部越界尝试        | 治理是否有效         |

任何自动化晋级都必须按问题类别独立判断，不能用一个流程的成功给全公司授权。

## 7. 四仓边界

| 仓库                 | 所有权                                                        |
| -------------------- | ------------------------------------------------------------- |
| `helm-public`        | 公共契约、公共服务、review-first 运行时、public-safe 合成样板 |
| `helm-packs`         | 行业对象、行业指标、行业策略与中立适配器                      |
| `helm-overlays`      | 客户/租户专属来源、权限、政策引用、私有配置和数据             |
| `helm-control-plane` | 授权、BOM、部署登记、版本库存、激活与回滚真值                 |

依赖方向保持：

```text
Overlay -> Pack SDK -> Core SDK
```

Core 不反向依赖 Pack 或 Overlay。真实凭据、客户数据、私有政策正文和部署回执都不得进入
Public Core。

## 8. 刻意不声明

- 不声明已有企业全源生产连接器。
- 不声明一把手问答运行面已经完整成立。
- 不声明客户 Company Memory 或企业世界模型已构建完成。
- 不声明自动外发、自动承诺、自动付款或自动高风险写入。
- 不声明 Helm-self、Sales Process Pack 或任何租户 Overlay 已部署。
- 不声明合成测试、页面截图或本地迁移等于生产运行证据。

## English Reference

Helm Stage 1 is an owner-authorized, read-only-to-review-first operating loop.
Its canonical path is authorization, observation, evidence, owner decision,
governed work packet, structured receipt, independent verification, evaluation,
and candidate memory. Public Core provides the neutral contracts and reference
runtime; Packs add industry semantics, Overlays hold tenant-specific data and
policy references, and Control Plane owns deployment and activation truth.

The current repository contains an implemented reference slice, not proof of a
complete customer production deployment. In particular, production connectors,
the full evidence-question runtime, customer data, and autonomous external
actions are deliberately not claimed.
