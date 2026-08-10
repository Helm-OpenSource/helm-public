---
status: active / wave-1a-implementation-candidate
owner: helm-core
created: 2026-08-09
review_after: 2026-09-09
public_safety: Public-safe project charter for the generic CAIO Pro FDE site operating loop. It contains no customer identity, tenant slug, private endpoint, credential, payload, deployment receipt, owner approval, production activation, or commercial commitment.
---

# Helm CAIO Pro FDE 现场经营闭环项目

> **项目阶段**：Owner 已批准 Wave 1A Public Core 实施；GAP-1/2 实现候选与锁定依赖下的
> 本地验证证据已形成，仍须经过独立 package-ready、release 与 BOM 评审。
>
> **证据边界**：本文是 Public Core 的项目启动规格，不是现场部署、运行激活、
> owner 授权或经营价值证明。任何私有现场只能通过 Overlay、Control Plane 与 FDE
> 回执证明，不能用本文、测试或本地运行替代。

## 0. 结论

本项目把 CAIO Pro 现场 FDE 的目标冻结成七个可测结果：

```text
能跑起来 -> 看得见 -> 理解得了 -> 诊断得清
          -> 决策明确 -> 执行到位 -> 监督及时
```

Public Core 只负责其中可复用、public-safe 的契约、确定性门禁、读写接缝和合成验证；
行业语义、客户映射、现场组合、部署健康、owner 授权和经营价值分别由其他权威层提供。
本项目不创建第二套问题、决策、任务或权限模型，并冻结以下术语与复用关系：

- `Portfolio` 只表示业务资产/案件范围，不表示经营问题组合；
- `CaioOperatingQuestionPortfolio` 才是由 Core 权威生成的恰好 10 题问题组合，
  并继续使用 `CaioQuestionSelectionReceipt`；
- `DecisionRecord`；
- `ActionItem` / `ApprovalTask` / `ExecutionReceipt`；
- 既有 workspace membership、`WorkspaceRole.OWNER` 与 service-governance 权限模型。

Wave 1A 只闭合 Decision Loop GAP-1 与 GAP-2。GAP-3 涉及 schema、迁移、保留与恢复
策略，必须经过独立批准后才能开始；本轮没有修改 schema/migration。

## 1. Objective / 项目目标

### 1.1 目标

形成一条可由现场 FDE 组合、可由 owner 复核、可由系统重放的经营闭环：

1. Core 权威生成器从经授权的数据资产、G0 上下文与 Pack 候选输入形成恰好 10 个
   经营问题；证据不足时只返回 `insufficient_evidence` 和缺口，不填充或凑数；
2. 由 CEO 选择 0-3 个问题，并绑定现有 `DecisionRecord`；
3. 把事实、推断、未知、风险、建议和禁止动作分开呈现；
4. 只有经既有审批链允许的动作才能进入
   `ActionItem` / `ApprovalTask` / `ExecutionReceipt`；
5. 用真实执行回执和业务结果驱动决策评估与监督信号；
6. 由 owner 在同一经营面看见运行、证据、诊断、决定、执行和监督状态；
7. 保持写回、真拨、通知、外部连接和自动执行默认 fail-closed。

### 1.2 非目标

- 不在 Public Core 写入客户名称、tenant slug、私有地址、连接配置或客户逻辑；
- 不把 Core 扩成第二套工作流、BI、通知中心、自治 Agent 或权限平台；
- 不为项目另建问题、决策、任务、回执或权限数据模型；
- 不在首个切片增加外部写回、外呼、通知、连接器或自动执行；
- 不把 source build、单元测试、合成闭环或组合包提升为现场部署、激活或价值证据；
- 不让 Pack 输出固定十题，不让 Overlay 或 Control Plane 复制 Core 的 13 项完成门字面量；
- 不让私有 executor 或 Control Plane 直接写 canonical `ExecutionReceipt`；
- 不改变“13 项现场部署完成门全部满足才完成，且完成不等于全功能激活”的定义。

## 2. Current Repo Truth / 当前仓库真值

### 2.1 已经存在并必须复用

| 能力 | 当前代码真值 | 本项目处理方式 |
|---|---|---|
| 业务范围 | `Portfolio` 的权威语义是业务资产/案件范围，不是问题列表 | 问题可引用其范围，但不得把它改名或序列化成十题组合 |
| 经营问题组合 | 已有恰好 10 题 `CaioOperatingQuestionPortfolio`、generation receipt、CEO 0-3 题 selection receipt 与 current head；不足十题走 `insufficient_evidence` | 只由 Core 权威生成器生成并绑定，不允许 Pack/Overlay/Control Plane 固定十题或补齐数量 |
| 决策 | `DecisionRecord` 已有生产者、已挂载消费者和 OWNER 可交互评审入口 | 继续作为唯一决策真值 |
| 执行 | 已有 Work Packet claim、`ActionItem`、`ApprovalTask`、canonical `ExecutionReceipt` 和独立复核 | 私有 executor 只产生执行证明/结果投影；只有 Core ingress/service 可按既有事务与权限写 canonical receipt |
| 监督读侧 | `/caio` 已挂载监督查询和读面 | 保留该入口；无真实数据时必须诚实显示暂无数据或降级原因 |
| 完成门 | 已有封闭有序的 13 项 `CAIO_PRO_V1_COMPLETION_ITEMS` | 全部真实回执满足后才可受理，且回执不授权全功能运行 |
| 权限 | workspace membership、OWNER role 与 service-governance 已存在 | 不新增平行角色、ACL 或 token 权限模型 |

### 2.2 当前开放缺口

以下事实由
[Decision Loop 缺口清单](../product/HELM_DECISION_LOOP_GAP_REGISTER.md)
及其机械门禁约束：

| 缺口 | 当前事实 | 对七项结果的影响 |
|---|---|---|
| GAP-1 | **Repo-closed in Wave 1A**：现有 approvals 终态路径在一个 `SERIALIZABLE` 协调事务内验证 canonical receipt 并调用 `recordStage1SupervisionSignal`；监督冲突会整体回滚 | 只证明生产代码可达与测试行为，不证明现场已有真实监督数据 |
| GAP-2 | **Repo-closed in Wave 1A**：同一事务先调用 `evaluateStage1DecisionRecord`，明确业务结果必须与 receipt outcome 和 workspace-scoped evidence 一致 | 只证明 repo truth；真实结果仍需私有 executor 投影、Core ingress 与现场回执 |
| GAP-3 | `lib/company-memory/` 是纯契约；Prisma 无 `KnowledgeCard` / `KnowledgeSource` 持久化 | “理解得了”的长期、可追溯 Company Memory 未成立 |

GAP-1/2 的关闭由 gap register 同时检查生产协调器、调用顺序和 approvals 入口；GAP-3
继续开放。现有 `MemoryFact` 的 `OBSERVED` 候选不能被表述成 Company Memory 知识卡持久化。

### 2.3 证据分层

| 层 | 能证明什么 | 不能替代什么 |
|---|---|---|
| Repo truth | 某提交中存在的代码、契约、schema、文档和门禁 | 测试通过、组合成功、现场运行 |
| 测试证据 | 对特定提交与环境执行过的确定性、单元、集成、E2E 结果 | 包内字节、部署状态、owner 授权 |
| 组合包证据 | Core / Pack / Overlay / Control Plane 的 package-ready implementation SHA、BOM、摘要与组装回执 | 项目章程 SHA、主机已安装、服务已运行 |
| 部署 truth | 目标设备、release、进程、端口、健康、数据库与恢复回执 | owner 授权、业务价值 |
| Owner 授权 | 具名 owner 对限定动作、范围、期限和撤销条件的批准 | 技术可用性、执行成功 |
| 经营价值证据 | 至少 30 天、基线可比、可归因的业务结果回执 | 部署或授权本身 |

任一层缺失时必须报告 `not_ready`、`degraded` 或明确缺口，禁止用相邻层补证。

## 3. Cross-Repo Contract / 跨仓输入输出

依赖方向保持：

```text
Overlay -> Pack SDK -> Core SDK
```

Public Core 不 import Pack、Overlay 或 Control Plane 私有路径。

| 责任层 | 本项目需要的输入 | 应产出的输出 | 禁止事项 |
|---|---|---|---|
| `helm-public` | 已有通用经营、决策、任务、回执和权限原语 | 版本化公共契约、Core 权威十题生成器、canonical receipt ingress、completion evaluator revision/hash、public-safe fixture、门禁与兼容范围 | 客户标识、客户配置、行业或客户执行器 |
| `helm-packs` | Core SDK 与兼容版本 | 仅输出行业分类法、指标、证据适用规则和候选输入 | 固定十题、`CaioOperatingQuestionPortfolio`、客户 tenant、凭据、私有 endpoint、单客户流程 |
| `helm-overlays` | Core / Pack 固定版本与公共扩展接缝 | 客户资产映射、授权引用、模型策略、只读 connector、受控 executor 及执行证明/结果投影 | 第二套 Core 模型、直接写 canonical receipt、复制十题或 13 项完成门字面量 |
| `helm-control-plane` | 四仓 package-ready implementation SHA、版本化接口 ref、设备与部署注册输入 | BOM、release、设备身份、部署、健康、回滚锚、owner 授权，以及非敏感摘要/hash/ref 索引 | 业务原文、canonical receipt 正文、13 项字面量、私钥、把登记状态当业务价值 |
| 现场 FDE | 已验证组合包、私有配置、最小权限账户和批准的接入范围 | 预检、安装、健康、恢复、验收、停止和价值回执 | 现场补包、绕过门禁、用临时配置伪造 activation |

### 3.1 四项强制跨仓输出

第一实施切片必须由 Public Core 发布以下四项版本化输出；缺任一项即不能作为跨仓
implementation handoff：

1. **业务范围与问题组合语义接口**：明确 `Portfolio` 是业务资产/案件范围，
   `CaioOperatingQuestionPortfolio` 是恰好 10 题的问题组合；二者 ID、引用和生命周期
   不可互换。
2. **Pack 候选输入与 Core 生成决定接口**：Pack 仅传行业分类法、指标、证据适用规则
   和候选输入；Core 权威生成器独立验证证据并只产生两类决定：恰好 10 题的
   `CaioOperatingQuestionPortfolio`，或 `insufficient_evidence` generation receipt 与缺口报告。
3. **执行结果投影与 canonical receipt ingress 接口**：私有 executor 产生受版本约束的
   执行证明/结果投影，不把它命名为 canonical receipt；Core ingress/service 重新验证
   workspace、DecisionRecord、Work Packet、ActionItem、ApprovalTask、权限、幂等和事务
   后写唯一 canonical `ExecutionReceipt`；Control Plane 只能索引非敏感 summary/hash/ref，
   不写、不镜像 receipt 正文。
4. **完成门 evaluator 身份接口**：发布接口版本、Core package-ready implementation SHA、
   `CAIO_PRO_V1_COMPLETION_EVALUATOR_REVISION` 和由 Core 确定性产生的 evaluator contract
   hash/ref。13 项有序清单继续只由 Core 拥有；Overlay 与 Control Plane 只能消费
   revision/hash/ref 及评估结果，不复制、重定义或独立计算 13 项字面量。

版本化接口必须有兼容范围、拒绝未知版本、摘要绑定和回滚说明。接口 ref、evaluator
revision/hash 或 Core implementation SHA 任一不匹配时，组合与完成评估均须 fail-closed。

### 3.2 Public Core 实现提交输出合同

每个可供其他仓消费的实现提交至少输出：

- immutable、package-ready 的 Core implementation SHA 与兼容说明；
- 上述四项版本化接口及其 schema/version/hash/ref；
- completion evaluator revision 与 contract hash/ref；
- 受影响公共契约和迁移要求；
- 测试命令与原始结果摘要；
- 当前开放 gap 与 fail-closed 行为；
- 回滚方式；
- 明确的非声明：未部署、未激活、未获 owner 授权、未证明经营价值。

本项目章程所在提交的 SHA 只能作为 planning provenance。它不是、也不得被登记为
package-ready Core implementation SHA、BOM 组件实现 pin、release stamp 或部署候选证明。
只有包含已批准实现、测试、守卫和上述四项接口输出且通过完整门禁的后续提交，才可进入
package-ready implementation SHA 的独立评审。

### 3.3 其他仓回传合同

Public Core 只接受 public-safe 的兼容性反馈和缺口代码。客户身份、私有字段、真实 payload、
凭据、endpoint、现场日志与部署回执必须留在其权威私有层；必要时仅回传脱敏摘要或不透明 ref。

## 4. Measurable Outcomes / 七项可测验收

### 4.1 能跑起来

**验收**：

- 固定组合包可验证 Core / Pack / Overlay / Control Plane 各自 package-ready
  implementation SHA、BOM 和摘要，不接受项目章程 SHA 代替；
- 目标运行时从不可变 release 启动，并有进程、工作目录、启动时间、监听面和健康回执；
- 数据库及必要依赖以最小权限完成只读或显式批准的连接检查；
- 失败时健康面返回具体缺口，不把进程存在等同于业务 ready；
- 回滚锚可恢复上一 release，恢复演练留有独立回执。

**Public Core 当前状态**：只形成代码、合同和合成证据；现场运行与部署 truth 不在本仓成立。

### 4.2 看得见

**验收**：OWNER 在既有 `/caio` 经营面可以看到：

- runtime 与数据来源的新鲜度、覆盖、异常和证据时间；
- 恰好 10 题的 `CaioOperatingQuestionPortfolio`、0-3 题选择、DecisionRecord、执行链与监督状态；
- loading、暂无数据、degraded、blocked、revoked 和 error 的诚实状态；
- 每项结论的 evidence ref、更新时间、责任人和下一门。

监督区域只有 seed 时不得显示成现场事实；不得另建第二个 CAIO 控制台或营销页。

### 4.3 理解得了

**验收**：

- 经营解释绑定已授权 DataAssetCatalog、accepted G0 与 Temporal Operating Context；
- 事实、推断、未知、冲突和过期信息分开，来源与时间可追溯；
- 知识项有状态、来源、适用范围、有效期、撤销和复核路径；
- 不完整或冲突上下文降低置信度并阻止越级动作。

**未成立条件**：GAP-3 未闭合前，不得声明持久化 Company Memory 或企业世界模型成立。

### 4.4 诊断得清

**验收**：每份诊断至少分开呈现：

1. 已证实事实；
2. 推断及依据；
3. 未知和证据缺口；
4. 风险及影响；
5. 建议与备选；
6. 禁止动作、停止条件和下一验证。

来源新鲜度、质量、覆盖和跨源冲突必须可见；无法支持的结论必须确定性拒绝，
“暂无数据”不能被写成“安全通过”或“没有风险”。

### 4.5 决策明确

**验收**：

- current accepted G0 下只有一份 current、恰好 10 题的
  `CaioOperatingQuestionPortfolio`；业务 `Portfolio` 只作为资产/案件范围引用；
- CEO 只可选择 0-3 题，选择由 `CaioQuestionSelectionReceipt` 固定；
- 每个选题一对一绑定现有 `DecisionRecord`，包含 owner、期限、成功指标、证据、
  alternatives、风险、允许动作级别和 rollback path；
- OWNER 可接受、拒绝、延期或要求补充证据，所有状态变化可审计；
- recommendation、decision、commitment 与 authorization 始终分开。

### 4.6 执行到位

**验收**：

- 只有受既有权限与 owner gate 约束的决定可产生唯一 Work Packet claim；
- 任务继续使用 `ActionItem`，审批继续使用 `ApprovalTask`；
- 私有 executor 只产生执行证明/结果投影；高风险动作要求独立复核，投影绑定证据、
  结果、责任和回滚状态，但不得被命名或写成 canonical `ExecutionReceipt`；
- Core ingress/service 按既有 workspace、事务、权限、审批、幂等与审计约束，写入唯一
  canonical `ExecutionReceipt`；
- Control Plane 只索引该 receipt 的非敏感摘要、hash 和不透明 ref，不存正文；
- 私有 executor 才可产生外部副作用，Public Core 不拥有客户系统凭据；
- 写回、真拨、通知、外部连接和自动执行默认关闭，并逐项独立授权；
- 完成任务不等于结果有效，必须由 GAP-2 的真实评估路径回流业务结果。

### 4.7 监督及时

**验收**：

- GAP-1 闭合：真实运行路径可幂等地产生 `SupervisionSignalRecord`；
- GAP-2 闭合：最终业务结果可幂等地评估现有 `DecisionRecord`；
- 回执缺失、逾期、偏差、知识过期、策略漂移和结果分歧可形成证据化信号；
- 每个信号包含 severity、owner、SLA、实际状态、期望状态、升级条件和 evidence refs；
- 系统只路由状态更新或受治理的干预草案，不自动执行干预；
- OWNER 能确认、升级、关闭或要求补证，超时仍保持可见。

## 5. First Implementation Slice / 第一实施切片

### 5.1 范围：GAP-1 + GAP-2

Owner 已批准本切片。Wave 1A 实现候选完成以下 repo-level 输出：

1. 选择现有 `verifyExecutedTaskReceiptAction` 作为唯一 canonical terminal trigger；
2. Stage1 分支以同一 workspace 和 Work Packet claim 调用 `reconcileStage1TerminalResult`；
   非 Stage1 回执继续使用原有独立验证路径；
3. 协调器在一个 `SERIALIZABLE` 事务内锁定 claim，依次调用 `verifyExecutionReceipt`、
   `evaluateStage1DecisionRecord` 和 `recordStage1SupervisionSignal`，任一步失败全部回滚；
4. terminal result 必须与 receipt outcome 一致，outcome ref 必须解析为当前 workspace、
   Opportunity Portfolio、DecisionRecord、ActionItem 与 ApprovalTask 绑定且仍有效的
   `ObservationSourceRun`；
5. private executor 只产生严格版本化并带 content hash 的结果投影；受认证 Gateway 与 Core
   ingress 校验 identity、workspace、Portfolio、evidence、work packet、CAS 后，唯一通过
   `recordExecutionReceipt` 写 canonical receipt；
6. S1 发布严格 Pack semantic graph 合同：可信 evidence snapshot 显式携带
   `evidenceRef -> evidenceKind`，taxonomy / metric / rule / candidateInput 的重复、悬空引用、
   rule coverage 缺失和 evidence-kind 不适用全部 fail-closed；
7. S2 的 Pack seam 不接受 question candidates、问题正文、外部 score/rank；Core 在现有事务中
   解析 workspace Portfolio、G0 evidence traces 与 S1 semantic graph，自行派生 eligibility、
   内容、事实/推论、score/rank、validation metric 与 narrow loop，再交给现有
   `CaioOperatingQuestionPortfolio` / generation receipt writer；semantic basis 复用每题现有
   `dependencyRefs` / `requiredDataRefs` 保存 candidateInput / taxonomy / metric / rule refs，
   不新增问题或回执模型；
8. 重放复用既有锁、receipt writer、DecisionRecord 内容匹配与 `workspaceId + signalKey`
   唯一键；冲突 projection 或 reconciliation payload/hash 均拒绝；
9. `/caio` 先显示 unresolved critical，再显示其他 unresolved，剩余位置显示 resolved，且
   每条展示 status；empty/degraded 语义保持不变；
10. `caio-pro-fde-cross-repo-contract.ts` 与可移植 JSON Schema 发布第 3.1 节四项接口的
   version、兼容集合、严格边界、contract hash/ref 和未知版本拒绝；identity 绑定规范化后的
   完整 artifact（全部 nested schema、enum、pattern、limit、ref rule）及版本化 semantic
   verifier rules；completion evaluator 发布 revision/hash/ref，且不暴露 13 项字面量给消费者；
11. Decision Loop gap register 与机械 checker 将 GAP-1/2 固定为 closed、GAP-3 固定为 open。

S1 当前接口身份为
`caio-pro-fde-cross-repo-interface:aeb075ce021b5899` /
`sha256:aeb075ce021b5899c27cc94696bcfe77343c1dd6adadbf2d9b15ee114aedd2d8`。
该身份只证明本仓 portable contract 的规范化内容；不证明 Pack 已挂载、问题已生成、组合包已
固定或现场已部署。

S2 现已在 Core repo 内形成确定性 generator/store seam：合法 Pack graph 的 candidate inputs
只能作为语义基底，不能携带完整问题；少于十个 eligible inputs 时沿用 canonical
`insufficient_evidence`，十个或更多时由 Core policy 选择并排名十题。该实现与 focused tests
以 `caio-operating-question-pack-derivation.v1` 绑定幂等 request hash，但不证明 S3 的
production composition provider、route 或 worker 已挂载，也不改变上述 portable contract
identity。

### 5.1.1 为什么选择该终态

`ApprovalTask` 对应的 `ActionItem` 已由 private ingress 记录 canonical receipt，且现有
approvals 入口具备独立复核身份；这是第一个同时具备执行证明、职责分离和生产 UI 入口的
位置。更早触发会把“任务已派发或已执行”误写成“业务结果已成立”；更晚新建第二入口会
复制任务、权限或回执语义。

业务结果仍须由 Stage 1 入口显式提供 `success|failure`、非空 `outcomeRef` 与是否采纳建议，
不能由 UI 任意手填覆盖 receipt；协调器要求其与 canonical receipt outcome 一致。receipt
证明执行，可信 ObservationSourceRun 证明结果，二者保持分层并同时受约束。

private executor ingress 只接收发生过执行尝试的 `SUCCESS / PARTIAL_SUCCESS / FAILURE`：
三者分别固定映射到 `success / failure / failure`，并把 ActionItem 收敛为 `EXECUTED`；后续
监督分别收敛为 `resolved / open / open`。`NOT_EXECUTED` 必须走既有 blocked-without-execution
路径，`REJECTED` 必须走既有 approval rejection 路径，二者进入该 ingress 一律在事务前
fail-closed。投影携带的 `outcome.result` 仍由可信 ObservationSourceRun 证明，但必须同时符合
receipt 固定映射，调用方不能独立翻转。

### 5.1.2 中断、并发与回滚

receipt 验证、评估、`MemoryFact.OBSERVED` 候选和监督在同一事务内提交；监督写入冲突或
任一异常会让前述写入全部回滚，不存在用文档解释的部分成功。相同输入的并发/重放收敛到
一份 receipt、一份评估、一份候选事实和一个确定性监督信号；receipt 结果、业务结果、证据、
projection 或是否采纳建议发生漂移时 fail-closed。本切片无 schema/migration，代码回滚保留
已经提交的 append-only 历史并撤回新生产入口。

本次原子提交在完整门禁通过后可作为 implementation candidate；是否成为 package-ready
Core implementation SHA，仍需独立 release/BOM 评审。项目章程提交绝不替代该 SHA。

### 5.2 明确排除

- 不新增 Prisma model 或 migration；
- 不实现 GAP-3；
- 不创建第二套事件总线、任务编排器或监督对象；
- 不新增客户 connector、写回、外呼、通知或自动执行；
- 不改变现有 OWNER、membership 或 service-governance 权限语义；
- 不声称 Public Core 的生产调用方等于任何现场已部署或已激活。

### 5.3 入口门

- owner 批准本规格和第一切片范围；
- `origin/main` 与实施 worktree 基线明确；
- GAP-1/2/3 机械门禁与当前代码一致；
- 触发点、事务边界、幂等键、失败重试和状态机已在实施计划中写清；
- 没有客户私有数据或跨仓实现进入 Public Core。

### 5.4 退出门

- GAP-1 与 GAP-2 各至少有一个非 seed、非测试的生产调用方；
- 生产调用方具备正常、重放、并发、撤销、跨 workspace、缺回执和失败恢复测试；
- `/caio` 在无数据时诚实为空，在真实记录存在时显示来源和时间；
- `check:decision-loop-gaps` 被同步更新为新真值，而不是删除控制项；
- 第 3.1 节四项接口各自具有 version、hash/ref、兼容范围和未知版本 fail-closed 测试；
- completion evaluator revision/hash 可被跨仓引用，但 13 项有序清单只由 Core 拥有；
- package-ready Core implementation SHA 指向包含实现、测试、守卫和版本化接口的提交，
  不得指向本项目章程提交；
- 完整 Public Core 验证链通过；
- 报告明确 GAP-3、现场部署、activation、owner 授权和价值证据仍未成立。

## 6. Task Breakdown / 任务分解

| 任务 | Owner 层 | 依赖 | 交付物 | 完成证据 |
|---|---|---|---|---|
| T0 项目规格批准 | Public Core owner | 本文 | 批准或修改决定 | 具名 review，不是代码提交 |
| T1 触发点与状态流设计 | `helm-public` | T0 | GAP-1/2 实施规格、事务/幂等/失败矩阵 | 代码级入口和调用链评审 |
| T2 GAP-1/2 最小实现 | `helm-public` | T1 | 生产调用接缝、测试、守卫、读面诚实状态、第 3.1 节四项版本化接口与 completion evaluator revision/hash/ref | implementation candidate SHA 与完整本地验证链；章程 SHA 禁止替代，package-ready 另行评审 |
| T3 GAP-3 批准门 | Public Core owner | T2 | 数据模型、保留、迁移、恢复和删除 ADR | schema/migration 单独批准；未批准不实施 |
| T4 行业问题与诊断适配 | `helm-packs` | 稳定 Core SDK | 行业分类法、指标、证据适用规则和候选输入 | Pack 门禁；不得输出固定十题或 `CaioOperatingQuestionPortfolio` |
| T5 客户现场适配 | `helm-overlays` | T2/T4 | 私有资产映射、授权引用、只读 connector、受控 executor 的执行证明/结果投影 | Overlay 边界与私有集成测试；只经版本化 Core ingress 写 canonical receipt |
| T6 组合与部署治理 | `helm-control-plane` | T2/T4/T5 | 固定 BOM、release、部署/健康/回滚/授权索引、非敏感 receipt summary/hash/ref 和 completion evaluator ref | 组合包与部署回执；不复制 receipt 正文或 13 项字面量 |
| T7 FDE 只读现场启动 | 现场 FDE | T6 | 预检、安装、只读健康、G0 资料和恢复演练 | deployment truth；非 activation |
| T8 经营闭环验证 | owner + FDE | T7 | 0-3 题、决策、执行、监督和 ≥30 天价值回执 | 13 项全部满足后方可受理完成门 |

跨仓任务由各仓自己的线程、branch 和 worktree 实施。本仓只发布公共输入与跟踪兼容性，
不得从此 worktree 直接修改其他仓库。

## 7. Commands / 验证命令

### 7.1 文档与边界

```bash
npx tsx scripts/check-doc-frontmatter.ts
npm run check:public-docs
npm run check:decision-loop-gaps
npm run check:caio-pro-v1
npm run check:public-release
npm run check:boundaries
git diff --check
```

### 7.2 第一实施切片

```bash
npm run typecheck
npm run lint
npm run check:decision-loop-gaps
npm run check:caio-pro-v1
npm run check:public-release
npm run check:boundaries
npm test
npm run quality:regression
npm run e2e
npm run build
```

MySQL 专项必须使用一次性空库，并同时设置 `DATABASE_URL`、
`STAGE1_OWNER_LOOP_DATABASE_URL` 与带 `helm_caio_stage1_` 前缀且精确匹配的
`STAGE1_OWNER_LOOP_TEST_DATABASE_NAME`。不得执行共享库 reset，不得复用现场生产库；
测试完成后删除一次性数据库。部署、组合和 owner 授权验证由其权威私有层执行，不能在
Public Core 命令中伪造。

## 8. Project Structure / 实际影响面

Wave 1A 只触及已有边界：

```text
lib/stage1-owner-loop/terminal-result-reconciliation.service.ts
lib/stage1-owner-loop/caio-pro-fde-cross-repo-contract.ts
lib/stage1-owner-loop/caio-fde-scope-resolver.service.ts
lib/stage1-owner-loop/private-execution-result-ingress.service.ts
lib/stage1-owner-loop/caio-operating-question-store.service.ts
lib/stage1-owner-loop/caio-pro-completion.ts
features/approvals/                     existing terminal action and UI
features/dashboard/                     existing OWNER read model and honest states
lib/caio-access-gateway/                 authenticated private projection route
tools/caio-access-gateway/server.ts      production composition for Core ingress
docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json
scripts/check-decision-loop-gaps.ts     mechanically checked reachability truth
colocated *.test.ts                     focused, permission, replay and boundary tests
docs/product/HELM_DECISION_LOOP_GAP_REGISTER.md
docs/STATUS.md
```

禁止新建平行的 `fde-*` 问题表、决策表、任务表、权限表或客户目录。

## 9. Code Style / 实现风格

- TypeScript strict，沿用已有 import alias、错误类、reason code 和 service-governance 检查；
- 写入保持 workspace scoped、幂等、事务化并通过冲突重试；
- 生产调用必须显式复用现有导出，不复制内部验证或绕过权限：

```ts
import {
  recordStage1SupervisionSignal,
} from "@/lib/stage1-owner-loop/decision-follow-through.service";
import {
  evaluateStage1DecisionRecord,
  type EvaluateStage1DecisionRecordInput,
} from "@/lib/stage1-owner-loop/decision-evaluation.service";
```

- reason code 使用稳定 ASCII 标识；UI 文案可双语，但不得泄露客户身份或原始 payload；
- 不新增依赖，除非现有能力无法满足且经单独评审；
- 评论只解释事务、幂等、授权或 fail-closed 的非显然原因。

## 10. Testing Strategy / 测试策略

### 10.1 必测路径

- 认证 private projection -> canonical receipt -> 原子终态协调 -> OWNER 读面；
- 同一事件重放不重复评估或写信号；
- 并发请求只有一个 canonical 结果；
- 跨 workspace、失效/撤销 evidence、结果与 receipt 不一致、缺回执或非终态结果全部
  fail-closed；
- supervision 冲突必须回滚 receipt verification、DecisionRecord evaluation 与候选 memory；
- OWNER/membership/service authority 不满足时拒绝；
- seed 关闭后的 honest-empty；
- 数据撤销、来源过期或证据缺失后，不把旧结论继续表述为当前事实；
- 业务 `Portfolio` 范围与 `CaioOperatingQuestionPortfolio` 十题组合不可互换；Pack 候选输入
  不能伪装成固定十题，Core 只能生成恰好十题或 `insufficient_evidence`；
- 私有 executor/Control Plane 直接写 canonical `ExecutionReceipt` 的路径被拒绝；只有
  Core ingress/service 可按既有事务与权限写入；
- 未知接口版本、错误 digest/ref 或 completion evaluator revision/hash 不匹配时 fail-closed，
  Overlay/Control Plane 不复制 13 项字面量；
- 既有 selection、DecisionRecord、ActionItem、ApprovalTask、ExecutionReceipt 和权限契约
  无回归。

### 10.2 证据要求

- 单元测试证明局部状态与拒绝理由；
- 隔离 MySQL 测试证明事务、CAS、重放和回滚；
- E2E 证明 OWNER 页面状态，不证明现场或客户数据；
- boundary guard 证明没有平行模型和跨仓 import；
- 测试输出记录 commit SHA、命令、时间和环境；
- 部署与经营价值必须另有部署回执和 ≥30 天结果回执。

## 11. Stop Conditions And Rollback / 停止与回滚

### 11.1 立即停止条件

出现任一情况即停止当前切片，不做现场补丁：

- 需要新增或修改 schema/migration 才能闭合 GAP-1/2；
- 需要第二套问题、决策、任务、回执或权限模型；
- 需要 Public Core 持有客户凭据、私有 endpoint 或真实业务 payload；
- 需要默认开启写回、外呼、通知、外部连接或自动执行；
- 找不到唯一 canonical 触发点、幂等键或终态语义；
- 无法保持跨 workspace 隔离、service authority 或 owner gate；
- 测试证据无法与部署、授权或价值证据分层；
- 四项版本化接口、completion evaluator revision/hash/ref 缺失、未知或互相不匹配；
- package-ready implementation SHA 被绑定为仅含项目章程、未含实现与完整门禁的提交；
- 任何仓库固定 SHA、BOM、回执或现场状态存在冲突。

### 11.2 回滚路径

第一切片不含 migration，因此回滚为：

1. 撤回独立实现提交，停止新的评估和监督生产调用；
2. 保留已经产生的 append-only 审计、DecisionRecord、ExecutionReceipt 和监督记录，
   不为“回滚干净”删除历史；
3. `/caio` 回到诚实的暂无数据或 degraded 状态；
4. 把 GAP-1/GAP-2 清单恢复为与回滚代码一致的开放真值并重跑门禁；
5. 私有部署层回退到上一 immutable release，保留部署与回滚回执。

GAP-3 的回滚必须在其独立 migration ADR 中定义 forward-fix、备份、恢复和数据保留，
不得沿用本切片的无 schema 回滚口径。

## 12. Boundaries / 行为边界

### Always

- 复用现有 canonical 模型、权限和审计；
- 明确事实、推断、建议、决定、授权、执行和结果；
- 默认只读/影子，外部副作用逐项 fail-closed；
- 绑定 workspace、证据、时间、责任、SLA、停止和回滚；
- 报告 repo truth、测试证据、组合包、部署、授权和价值的独立状态。

### Ask First

- 任意 schema/migration、公开契约破坏、权限语义或新依赖；
- GAP-3 的持久化、保留、删除和恢复设计；
- 任意写回、真拨、通知、外部连接、自动执行或 autonomy 升级；
- 13 项完成门、30 天价值定义或 owner gate 的变更；
- 客户现场从 shadow/read-only 进入受控写入。

### Never

- 在 Public Core 放客户名称、tenant slug、私有地址、凭据、个人数据或真实 payload；
- 用 seed、fixture、本地测试、截图、文档或包摘要宣称现场已部署或已激活；
- 让 recommendation 充当 commitment，或让完成门回执充当全功能授权；
- 绕过 `CaioQuestionSelectionReceipt`、`DecisionRecord`、
  `ActionItem` / `ApprovalTask` / `ExecutionReceipt` 或既有权限模型；
- 让 Pack 输出固定十题，让 Overlay/Control Plane 直接写 canonical `ExecutionReceipt`，
  或让它们复制 Core 的 13 项完成门字面量；
- 把项目章程 SHA 登记为 package-ready Core implementation SHA；
- 删除历史回执来掩盖失败、撤销、回滚或分歧。

## 13. Success Criteria / 项目完成标准

本项目只有在以下条件全部成立时才算完成，而不是在本规格提交时完成：

1. 七项结果分别有真实、当前、可重放的验收证据；
2. GAP-1、GAP-2、GAP-3 均已按各自批准门闭合；
3. 四仓各自 package-ready implementation SHA、BOM、四项版本化接口、组合包与兼容性
   验证通过，且没有用章程 SHA 替代实现 SHA；
4. completion evaluator revision/hash/ref 可由跨仓确定性引用，13 项字面量仍只由 Core
   拥有且未被 Overlay/Control Plane 复制；
5. 现场运行、健康、备份、恢复、安全和回滚 evidence 成立；
6. 0-3 个选题至少一条决策、执行、监督链真实闭合；
7. 每个进入价值验收的选题具有不少于 30 天的可比业务结果；
8. 13 项完成门全部满足并由 CEO 受理；
9. 全功能运行仍由独立 owner 授权决定，未授权能力保持关闭；
10. 没有未处置的权限、数据、模型出域或执行边界事故。

## 14. Risks And Dependencies / 风险与依赖

| 风险 | 后果 | 缓解 |
|---|---|---|
| 把 UI/测试当现场事实 | 过早宣布 ready | 六层证据分离，部署与价值由私有权威层签发 |
| GAP-1/2 触发点选错 | 重复写、漏写或状态错序 | 先做调用链和事务设计，隔离 MySQL 并发/重放测试 |
| GAP-3 顺手并入 | schema、迁移和删除风险扩大 | 独立 owner 批准门与单独提交 |
| 客户需求污染 Core | 破坏公开安全和依赖方向 | 客户映射与执行器只进 Overlay |
| 跨仓各自解释接口或复制 13 项 | 十题、receipt 或完成评估发生漂移 | Core 发布版本化接口和 evaluator revision/hash/ref；其他仓只消费引用 |
| canonical receipt 出现多写者 | 权限、事务、幂等和审计失真 | executor 只交证明/结果投影，唯一写入经 Core ingress/service |
| 章程 SHA 被登记为实现 SHA | 未实现能力被错误装包或发布 | planning provenance 与 package-ready implementation SHA 分离并 fail-closed |
| 自动执行范围漂移 | 未授权外部副作用 | 默认关闭、逐动作授权、kill switch 与回滚回执 |
| 13 项门被简化 | “部分通过”冒充完成 | 保持 closed ordered list 与 all-or-nothing 评估 |
| 监督延迟或噪声过多 | owner 无法及时处置 | severity、SLA、幂等、责任和升级条件结构化 |

## 15. Decisions And Open Questions / 已决与待裁定

已决：

1. Owner 批准 Wave 1A 只闭合 GAP-1/GAP-2，明确不含 GAP-3；
2. 唯一 production trigger 为现有 approvals 路径中的 canonical receipt 独立验收，且必须
   显式提供最终业务结果，不能从 receipt outcome 推断。

仍待裁定，且不阻止本轮 repo-level 实现：

1. 监督信号的默认 SLA、升级责任和关闭权限是否沿用现有字段，还是需要另行产品裁定？
2. GAP-3 是否进入下一里程碑；若进入，知识卡保留、删除、恢复和客户数据权利由谁批准？
3. 私有现场首先选择哪个经营问题进入 shadow/read-only 验证？该答案只能记录在私有 Overlay/FDE 资料中。
4. 哪些外部动作在现场始终保持关闭，哪些可在完成门后申请单独 owner 授权？

## 16. 变更记录

- 2026-08-09：建立 `planning / proposed` 项目章程；冻结七项可测结果、六层证据、
  四仓输入输出、GAP-1/2 第一切片、GAP-3 独立批准门、停止条件与回滚路径。
- 2026-08-09：第二轮契约修正；区分业务 `Portfolio` 与十题
  `CaioOperatingQuestionPortfolio`，冻结 Pack 候选输入边界、canonical
  `ExecutionReceipt` 唯一写入链、四项版本化跨仓输出、completion evaluator
  revision/hash/ref，以及章程 SHA 不得替代 package-ready implementation SHA。
- 2026-08-09：Owner 批准 Wave 1A；选择现有 approvals canonical receipt 独立验收为
  唯一 terminal trigger，形成 GAP-1/2 生产协调器、显式业务结果输入、并发/重放与跨
  workspace 测试、`/caio` resolved 结果可见性、版本化跨仓 contract hash/ref 和新 gap
  checker。GAP-3、schema/migration、组合包、部署、激活与经营价值均未成立。
