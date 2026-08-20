---
status: draft / pending-owner-review
owner: helm-core
created: 2026-08-19
review_after: 2026-09-19
public_safety: Public-safe reference design for a client-neutral Member Gateway
  between employee-facing agent clients (Tencent WorkBuddy as the first
  reference client) and Helm CAIO. It contains no customer data, private
  endpoint, credential, production receipt, deployment approval,
  external-write authority, or production-readiness claim.
---

# 员工客户端与 Helm CAIO 成员网关设计（Member Gateway）

> English title: Member Gateway Design between Employee Agent Clients and
> Helm CAIO

## 1. 目的与关系定位

CEO 版 WorkBuddy 设计（`2026-07-23-workbuddy-caio-lan-collaboration-design.md`）
解决的是"一号位与 CAIO 的单线热线"。本设计把这条链路扩展到工作区成员：
员工通过外部 agent 客户端接收 CAIO 的投递、提交证据与回执、行使响应权，
并让客户端自带模型基于受治理投影的上下文辅助员工工作。

关系模型冻结为三条互不混淆的线：

- **组织线**：CAIO 是"企业首席 AI 高管，直属并只向 CEO 汇报，统领领域
  Agent"（见产品治理 ADR §2）。员工客户端是成员接收投递、提交回执、行使
  refuse / pause / appeal 响应权的交互面，不是 AI 同事，也不是管理者。
- **信任线**：员工客户端永远是外部 agent surface，不是受信数据平面。客户端
  选什么模型、数据是否本地，Helm 不推断也不信任；进出只有受治理投影。
- **权限线**：汇报关系不等于授权关系。接入本身不产生任何权限；成员能读什么、
  能写什么，全部落到本设计定义的授权交集与写入语义分类上。CAIO 角色与
  Member Gateway 都不是权限令牌。

契约主体是**客户端中立的 Member Gateway（MCP 工具面）**。腾讯 WorkBuddy 是
第一个参考客户端；任何客户端接同一契约，不产生客户端专有协议。

## 2. 现状与依赖

本设计直接依赖并且不得复述、不得放宽以下真值：

- 产品治理 ADR：`docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md`
  （角色定义、治理不变式、成熟度轴、OWNER ≠ CEO）。
- 模型准入与出域：`docs/product/HELM_CAIO_MODEL_ADMISSION_AND_EGRESS.md`
  （分类、投影、路由、回执；未知分类默认 `restricted + local_only`）。
- CEO 版设计：`docs/superpowers/specs/2026-07-23-workbuddy-caio-lan-collaboration-design.md`
  （envelope、投影两档、prepare/submit、challenge、数据出域禁止清单）。
- 治理类型契约：`lib/caio-governance/types.ts` / `contract.ts`
  （`CaioHumanResponse` 的 refuse / pause / appeal 一等地位、
  `retaliationProhibited: true` 冻结字面量、
  `dispatchTargetCategories: readonly []` 空元组不可表达派发目标）。

本设计是 implementation-ready 的需求与架构基线，不证明任何组件已经实现、
已经部署或已获生产授权。

## 3. 范围与非目标

本设计负责：

- Member Gateway 的工具面契约、写入语义分类、信任分级、投影判定与审计要求；
- 三个阶段（读 → candidate 写 → 监督投递）的能力边界与成功标准；
- 四仓落位边界。

本设计明确不做：

- **Work Packet 派发。** 当前版本不包含 Work Packet object kind、payload
  字段或 submit action；schema 上不可表达（与
  `dispatchTargetCategories: readonly []` 同一模式），未来只能通过新
  schema version 与独立设计引入。本文件任何内容不构成 Orchestrate /
  Authorized Execute 阶段的解锁依据。
- **LLM 代理。** CAIO 不为员工客户端代理、过滤或增强模型调用；客户端用
  自己的模型，Helm 只通过工具面返回受治理投影（"投影上下文模式"）。
- 客户端产品选型背书、真实租户策略、生产部署、凭据与设备管理实现。

## 4. 身份模型

- **成员主体 vs 显式绑定的 CEO principal。** Member Gateway 的主体是工作区
  成员（live membership）。`WorkspaceRole.OWNER` 是工作区权限角色，本身
  不能证明 CEO 身份；CEO principal 只能由私有 Overlay 显式绑定。CEO 版
  链路与成员版链路的差别是主体绑定与投影范围，不是"OWNER vs 成员"。
- 每次调用绑定：成员会话 + 注册设备记录 + clientId。设备注册只证明
  "这台设备被登记过"，不是身份认证的替代，也不是权限来源。
- 三者均可由管理端独立撤销。**撤销的对象是会话、成员绑定、设备或 client
  access；撤销不得删除或改写任何已经形成的历史治理回执与审计记录。**

## 5. 写入语义分类（冻结）

成员经 Gateway 产生的内容分为四类，语义与生效路径互不混用：

| 类别 | 内容 | 语义 |
|---|---|---|
| `candidate_write` | 进展、障碍、客户信号、自由文本回答 | candidate evidence / assertion，进入经营记忆前始终带来源标注与 candidate 标记；晋升为事实只走既有记忆提升链路 |
| `interaction_receipt` | 已读、打开、稍后处理 | canonical delivery / interaction receipt，直接生效，但**无任何事实晋升效果** |
| `protected_human_response` | refuse / pause / appeal | canonical `CaioHumanResponse` 治理记录。**不是 candidate，不经过记忆提升即生效**；提出本身永远合法，校验只查可审计性与关联完整性，不能裁定响应越界；记录携带 `retaliationProhibited: true`，不得作为负面评价输入 |
| `authority_bearing_action` | 可能形成组织承诺或外部影响的确认动作 | 只有既有独立权限系统对该成员、该对象、该动作明确授权后才能确认。成员身份、设备签名、challenge 和 Gateway 本身都不能创造该权限；无授权时 Gateway 返回明确阻断，不提供"升级路径" |

### §5.1 候选晋升接缝（M2c，owner 裁定 2026-08-20）

成员信号（`candidate_write`）从回执走向可审阅材料、再走向任务晋升的接缝，
遵循 owner 于 2026-08-20 对
`docs/superpowers/plans/2026-08-20-member-gateway-m2c-design-questions.md`
六项决策问题的裁定，规范如下：

1. **接入形状**：信号候选走一个与既有 governed-candidate 并列的平行
   artifact 类型，复用既有 `ArtifactBundle`/`ArtifactReview` 表与既有
   `/approvals` 审阅面，不新建审阅通道、不新增 kind 列。类型判别只靠两个
   冻结字符串字面量——`artifactType = "member_work_signal_candidate.json"`、
   `reviewPosture = "member_work_signal_candidate_review_required"`——叠加
   `systemOfRecordWrite: false`。
2. **taint 一等字段**：该 artifact 必须携带字面量字段
   `taint: "untrusted"`、`evaluationUseProhibited: true`、
   `promotionAllowed: false`；三者是 artifact 结构本身的一部分，不是可选
   metadata，也不因下游处理而丢失。任何审阅呈现面必须把 taint 作为一等
   标记渲染，不得降级为次要说明文字或被裁剪。
3. **脱链接化投影**：候选正文（投影后的 summary/detail）禁止携带链接；
   信号原文中的 URL 一律替换为 opaque 的 `linkEvidence` token，原始 URL
   只保留在信号回执（`MemberWorkSignalReceipt`）中，永不进入候选正文。
4. **对象锚点**：候选携带的对象锚点是一个判别联合——已解析到既有对象
   类型的分支，与保留原始 opaque 引用的未解析分支。无法解析到已知对象
   类型的信号不因此被拒绝晋升为候选，仍然可进入审阅。
5. **证据按需升面**：候选携带的关联证据一律是 opaque 引用；审阅人需要
   按引用逐条下钻查看原始证据时，须为该引用重新跑一次工作区级授权投影
   （复用既有七元交集判定，交集主体从信号提交成员换成审阅人本人），而
   不是直接继承成员当时的授权。该投影是运行时义务；本节确认该义务存在，
   其执行路径不在本节规范范围内。
6. **晋升终点分两阶段**：第一阶段只允许候选晋升为任务，产物是
   `ActionItem` + `ApprovalTask`，并沿用既有审批链既有约束（如
   REQUIRES_APPROVAL）；候选本身不授予任何权限，不构成任何承诺。晋升为
   经营记忆事实（`MemoryCandidate`）是第二阶段，需要为成员网关引入会话
   锚点，属于另立设计范畴。成员不能审阅或晋升自己提交的信号——这是能力
   体系既有的结构性结果（MEMBER 能力集合为空集，不含
   `REVIEW_GOVERNED_ACTIONS`/`PROMOTE_GOVERNED_CANDIDATES`），本节重申其
   适用于候选晋升接缝。

## 6. 三层能力与工具面

所有工具复用 CEO 版统一 envelope（`ok / requestId / serverTime / data /
error / boundary`），`boundary.authorityEffect` 恒为 `none`，
`externalExecutionAllowed` 恒为 `false`。

### 6.1 L1 读（问答与助手增强共用一套工具）

| Tool | 作用 | 关键边界 |
|---|---|---|
| `get_my_brief` | 与我相关的事实、风险、待办摘要 | 展示数据截止时间 |
| `ask_caio`（成员版） | 就成员授权面内对象提问 | 简单问题同步返回；深度推理返回 `questionRunId` |
| `get_caio_answer`（成员版） | 读取异步 run 的 `EvidenceAnswerPacket` 投影 | facts / inferences / unknowns / conflicts 分离 |
| `continue_caio_question`（成员版） | 相同或更窄 evidence scope 下追问 | 不静默扩大 scope |
| `query_evidence`（成员版） | 下钻已授权 evidence ref | `local_only` 返回 metadata only |
| `get_context_pack` | 按声明用途取结构化上下文包（备会、写材料、电话准备） | 同一投影规则；`purpose` 进入投影判定与审计 |

客户端模型把 L1 工具当上下文源，"个人助手增强"即成立，不设独立能力。
模型流畅度不得提高 evidence confidence。

### 6.2 L2 candidate 写（信号上行）

- `submit_work_signal`：prepare/submit 两阶段；challenge 一次性、绑定
  workspace、member、object、version、payload hash 与过期时间。
- 每条信号入库即为 append-only 回执，携带成员、设备、clientId、policy
  version 与 payload hash。
- **更正与撤回使用 superseding receipt**：新回执引用并取代旧回执，历史
  不可覆盖、不可删除。
- 上行信号在进入任何推理上下文前必须通过 schema 校验、恶意内容检查与
  越权引用检查（见 §9）。

### 6.3 L3 监督投递与响应

- 成员版 prompt 队列：`poll_my_prompts` / `list_my_pending_prompts` /
  `get_my_prompt` / `prepare_prompt_response` / `submit_prompt_response` /
  `get_prompt_response_receipt`，复用 CEO 版投递 envelope 语义，主体换为
  成员，evidence 投影按成员授权面收窄。
- 队列语义补齐：cursor 分页、幂等键、`expectedVersion`；投递支持
  withdraw / expire / snooze / suppression，全部留回执。
- **critical severity 必须来自确定性规则**（不由模型自由判定），并支持
  工作时间、静默期与防打扰配置；严重度、响应速度与响应内容均不得成为
  人员评价信号。
- 响应按 §5 分类落库：普通回答走 `candidate_write` 或
  `interaction_receipt`；refuse / pause / appeal 走
  `protected_human_response`；涉承诺确认走 `authority_bearing_action`。

## 7. 信任分级

| 动作等级 | 要求 |
|---|---|
| 读（L1） | 成员会话 + 注册设备 + clientId |
| `candidate_write` / `interaction_receipt` | 上一档 + prepare/submit 一次性 challenge |
| `protected_human_response` | 上一档 + 强身份校验（user-presence 或本地界面确认）。**必须始终存在可用的本地兜底路径；user-presence 能力缺失、设备故障或客户端不支持时，不得实质剥夺或延迟响应权的行使。** 强校验的目的仅是抗抵赖，不是提高门槛 |
| `authority_bearing_action` | 既有独立权限系统的显式授权 + 强身份校验 + 一次性 challenge；缺授权直接阻断 |

`protected_human_response` 与 `authority_bearing_action` 是两个语义档：
前者不产生任何组织权限、永远合法；后者以外部权限为前提。两者不得共用
校验路径、错误码或审批语义。

## 8. 数据边界与投影

### 8.1 有效读取面（冻结为交集）

```text
live membership
∩ application/tool scope
∩ object-level relationship authorization
∩ field/purpose policy
∩ source authorization
∩ tenant/provider egress policy
∩ current classification
```

- 必须**逐对象、逐次服务端校验**；"与我相关"是展示概念，不是授权依据。
- 未知分类默认 `restricted + local_only`，直接继承模型准入/出域契约。
- 进入员工客户端的任何内容默认视为已进入该客户端所选 provider；租户
  egress policy 按 provider 批准面收窄投影。

### 8.2 投影判定依据（envelope 必带）

除 `projection: "remote_projected" | "metadata_only"` 外，boundary 至少携带：

- `projectionPolicyRef` 与 version；
- `providerRef` 或批准的 provider profile；
- `purpose`；
- `classifiedAt` 与 freshness；
- `deniedFields` 或机器可判定的阻断原因。

`metadata_only` **使用字段白名单定义**，不是"除正文外都可返回"——对象
存在性、客户与项目名称、人员关系本身都可能泄密。最小化、别名化与禁止
清单直接继承 CEO 版 §10（`local_only` 原文、restricted 原始证据、附件、
凭据、完整个人信息、占位符映射表一律禁止）。无法安全投影时返回
`LOCAL_VIEW_REQUIRED`。

## 9. 提示注入与上行内容污染（可测试契约）

结构化 JSON 只是基础，不单独构成防线。以下为组合约束，每条都必须有
对应的合成测试：

1. 内容字段与控制字段类型隔离；证据文本永远不出现在控制位置。
2. 证据文本与上行信号始终携带 untrusted / tainted 标记，跨层传递不丢失。
3. 不允许证据内容生成工具名、scope、URL 调用或系统指令。
4. 字段长度、链接数量与嵌套深度设上限，超限拒绝。
5. quarantine 记录不得直接进入任何外部 provider 上下文。
6. 上行信号经过 schema 校验、恶意内容检查与越权引用检查后才可入库。
7. 工具 handler 只能调用 application service，不直接操作数据库。

## 10. 审计与回执

- 所有写入产生 append-only 回执，绑定 workspace、member、object、
  version、payload hash、policy version、设备与 clientId。
- 幂等键防重复回执；`expectedVersion` 防并发覆盖；重放返回原回执。
- `protected_human_response` 的申诉链路（raised → acknowledged →
  resolved / escalated_to_ceo）全程可审计。
- 撤销（会话、设备、client access、成员绑定）本身留回执；历史回执不可
  删除、不可改写。

## 11. 分阶段路线

| 阶段 | 交付 | 前置 |
|---|---|---|
| M1 读 | L1 工具 + 成员投影 + 投影判定依据 | Observe / Advise 已 `formed`，无成熟度阻塞 |
| M2 写 | `submit_work_signal` + candidate 入库 + superseding receipt | M1 投影与审计基线 |
| M3 投递 | 成员 prompt 队列 + §5 四类写入语义 + §7 信任分级完整落地 | M2；critical 规则与防打扰配置 |
| 派工 | **不做**。schema 不可表达；新 schema version + 独立设计 | Orchestrate 解锁（当前 `roadmap_disabled`） |

## 12. 指标与非绩效化约束

产品指标：

- M1：员工周活跃提问数、context pack 调用占比；
- M2：上行信号量；CAIO 回答中引用上行信号的比例，**必须区分"作为带
  标签 candidate 被引用"与"已晋升为事实后被引用"**；
- M3：投递响应率与时延分布。

冻结约束：

- 以上指标默认只做**租户级聚合**，不形成个人排行；
- 不得用于员工绩效、纪律处分或任何负面评价；
- 拒绝、暂停、申诉、未响应、低使用率均不得成为负面信号；
- 该约束与 `retaliationProhibited` 冻结字面量同源，属于治理契约而非
  产品偏好。

安全指标（目标恒为零）：

- 越权读取 0；`local_only` 内容泄漏 0；撤销后成功调用 0；
  `protected_human_response` 写入丢失 0；重复回执 0。

## 13. 四仓落位

| 仓 | 责任 |
|---|---|
| `helm-public` | Member Gateway 公共契约、写入语义分类、投影判定与逐对象授权的公共执行逻辑、基础 signal / context-pack 类型、合成测试 |
| `helm-packs` | 行业化 context pack 与信号类型扩展（不持有基础类型） |
| `helm-overlays` | 租户成员绑定、CEO principal 绑定、provider 批准面、设备与静默期策略等私有策略 |
| `helm-control-plane` | entitlement、BOM、部署登记与生产回执 |

Core 不反向依赖 Pack 或 Overlay。成员认证与逐对象授权的执行逻辑留在
`helm-public`，Overlay 只保存租户绑定和私有策略。

## English Summary

This design extends the CEO-only WorkBuddy loop to workspace members via a
client-neutral Member Gateway (MCP toolset). Tencent WorkBuddy is the first
reference client, never a trusted data plane; clients bring their own model
and receive only governed projections (projection-context mode — Helm is not
an LLM proxy). Member writes are frozen into four semantic classes:
candidate writes (signals, free-text answers), canonical interaction
receipts (read/opened, no fact effect), protected human responses
(refuse / pause / appeal — canonical governance records that are always
legitimate, never memory-promoted, and retaliation-prohibited), and
authority-bearing actions (valid only with pre-existing independent
authorization; identity, signatures, and the gateway itself grant nothing).
The effective read surface is the intersection of live membership, tool
scope, object-level authorization, field/purpose policy, source
authorization, tenant/provider egress policy, and current classification,
enforced server-side per object per call. Work Packet dispatch is not
expressible in the current schema and requires a new schema version plus a
separate design. Adoption metrics are tenant-aggregated only and must never
feed performance evaluation; refusal, pause, appeal, non-response, and low
usage are never negative signals. §5.1 specifies the candidate promotion
seam: candidate-write signals may materialize into a parallel, first-class
`taint`-bearing artifact type that reuses the existing governed-artifact
review chain and, in this stage, promotes only to tasks — never directly to
memory fact.
