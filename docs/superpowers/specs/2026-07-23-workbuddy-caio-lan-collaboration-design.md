---
status: design-approved / implementation-not-started
owner: helm-core
created: 2026-07-23
review_after: 2026-08-23
public_safety: Public-safe reference design for a Tencent WorkBuddy desktop client and Helm CAIO Pro on one trusted LAN. It contains no customer data, private endpoint, credential, production receipt, deployment approval, external-write authority, or production-readiness claim.
---

# 腾讯 WorkBuddy 与 Helm CAIO Pro 内网协作设计

## 1. 决策摘要

本设计定义第一阶段的 CEO 桌面协作路径：

- Helm CAIO Pro 运行在客户控制的 Mac Studio 上；
- CEO 在一台个人独占的 macOS 电脑上使用腾讯 WorkBuddy；
- 两台设备只在同一公司可信内网内协作；
- WorkBuddy 通过受控的 Helm MCP Gateway 主动提问、读取证据、接收 CAIO 主动问题并提交复核结果；
- 严重问题在一分钟目标窗口内出现，普通问题每三十分钟合并；
- 所有决定只形成治理记录与回执，不产生外部执行权限；
- 手机、企业 IM、公网入口和 Tailscale/WireGuard 延后；
- 后续远程网络只替换传输层，不改变 MCP 工具、身份、数据投影和回执契约。

本设计是 implementation-ready 的需求与架构基线，不证明 Gateway、WorkBuddy Skill、
客户证书、真实 LAN 部署或生产运行已经成立。

## 2. 背景与现有真值

Helm CAIO Pro 的产品要求已经定义 `CEO 电脑控制面 <-> CAIO Pro Node`，并要求实时问答、
建议决策、证据下钻、设备证书和双向认证。当前 Public Core 已有：

- `OwnerQuestionPacket` / `EvidenceAnswerPacket`；
- CAIO mandate 与 CEO principal binding 治理记录；
- `CaioAdviceRecord`、CEO 决策与非权限型回执；
- Stage 1 只读观察、决策、监督与回执链；
- 数据资产目录、敏感度和处理处置；
- 外部智能体候选材料的 review-first 边界。

当前仍没有可供 WorkBuddy 使用的正式 MCP/HTTP Gateway、设备注册、问题投递队列或
真实内网部署。因此 WorkBuddy 不能直接连接 MySQL、调用内部 service、读取 Mac Studio
文件或依赖浏览器自动化冒充集成。

腾讯 WorkBuddy 当前公开文档说明其支持自定义 Skill、第三方 API 调用以及 MCP + CLI
连接器。该能力只说明存在集成表面，不授予 WorkBuddy 对 Helm 的信任或权限：

- [WorkBuddy Skill](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)
- [WorkBuddy Connector](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector)
- [WorkBuddy task and permission modes](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Task-Bar)

## 3. 目标

### 3.1 CEO 主动提问

CEO 可以在 WorkBuddy 中：

- 询问经营事实、风险、阻塞、建议和待判断事项；
- 查看回答中的 facts、inferences、unknowns、conflicts、evidence refs、freshness 和 confidence；
- 在授权范围内继续追问和下钻证据；
- 把回答中的建议转为待复核候选；
- 在证据不足、过时、冲突或越权时得到明确降级或拒答。

### 3.2 CAIO 主动提出问题

CAIO 可以把满足确定性触发规则的现有治理对象写入 CEO 投递队列：

- P1C 首批经营问题来自 `CaioOperatingQuestionPortfolio`，不得复制成第二套问题真值；
- 其他主动问题可以引用 `CaioAdviceRecord`、`DecisionRecord` 或
  `SupervisionSignalRecord`；
- 严重投递：WorkBuddy 每分钟检查，目标是在一分钟窗口内呈现；
- 普通投递：WorkBuddy 每三十分钟拉取并合并；
- CEO 可以回答、要求补充证据、稍后处理、拒绝回答或抑制同类问题；
- 投递支持去重、撤回、过期、版本冲突和投递回执；业务对象状态仍由其原有 service 管理。

这里的“推送”是产品体验语义。MCP 调用仍由 CEO 电脑发起；第一阶段不允许
Mac Studio 主动连接或远程控制 CEO 电脑。

### 3.3 建议复核

CEO 可以对合法、未过期的 CAIO advice：

- 接受；
- 拒绝；
- 延期；
- 要求修改。

接受、拒绝和延期复用现有 `CaioAdviceDecisionOutcome`。要求修改在第一阶段记录为
`deferred` 决策，并附带结构化 revision request 候选；它不直接改写原 advice。

任何选择只产生治理记录和 `authorityEffect: "none"` 的决定回执。它不发送消息、
不派任务、不写 CRM、不激活 connector、不签发 mandate，也不能成为执行权限令牌。

## 4. 非目标

第一阶段刻意不做：

- Tailscale、WireGuard、VPN 或跨公网访问；
- 手机应用、企业微信、飞书、QQ 或其他 IM 通知；
- 公开互联网端点、端口转发或云中继；
- WorkBuddy 对 MySQL、SSH、Mac Studio 文件系统或 Helm 管理后台的直接访问；
- CRM 写回、消息外发、日程创建、资金、法律或人员动作；
- WorkBuddy 自动代表 CEO 作答、复核或签发 mandate；
- 把 WorkBuddy 视为 Company Memory、经营真值或权限系统；
- 把本设计写成生产 readiness、客户承诺或部署批准。

## 5. 已确认的使用约束

| 维度 | 第一阶段决定 |
|---|---|
| WorkBuddy 产品 | 腾讯 WorkBuddy |
| CEO 设备 | macOS，CEO 个人独占 |
| CAIO Pro 设备 | Mac Studio |
| 网络 | 同一公司可信内网；离开内网即不可用 |
| 交互级别 | 读取 + 主动提问 + 问题推送 + 建议复核 |
| 外部执行 | 禁止 |
| 手机 | 不在第一阶段 |
| 严重问题时效 | 一分钟目标窗口 |
| 普通问题时效 | 三十分钟合并 |
| 远程网络 | 后续独立阶段 |

## 6. 方案比较与选择

### 6.1 浏览器自动化

WorkBuddy 打开并操作 Helm Dashboard。改造少，但页面变化会破坏流程，无法形成稳定
工具契约，身份、幂等和审计也不足。只允许用于人工演示，不作为集成路径。

### 6.2 自定义 Skill 直接调用专有 REST API

实现较快，但会形成 WorkBuddy 专有协议，容易在 Skill 与 Helm 之间复制权限、错误码和
治理语义。可以作为 Gateway 内部实现细节，不作为 CEO 侧公共契约。

### 6.3 Remote MCP Gateway

WorkBuddy 通过 MCP over HTTPS 调用小而封闭的 Helm 工具集。工具按读取、准备和提交
分层，容易施加 scope、幂等、数据投影和审计。第一阶段采用此方案。

## 7. 逻辑架构

```text
CEO
 |
 v
Tencent WorkBuddy on CEO macOS
  - dedicated "Helm CAIO" workspace / expert
  - Helm reference Skill / connector
  - default Ask / normal permission posture
  - polling schedules: 1 minute + 30 minutes
 |
 | MCP over HTTPS
 | mutual TLS + application scopes
 v
Helm CEO MCP Gateway on Mac Studio
  - device authentication
  - request validation and projection
  - tool dispatch
  - rate, replay and idempotency control
 |
 | existing application services only
 v
Helm CAIO Pro
  - question / evidence contracts
  - P1C operating-question portfolio and selection
  - typed delivery outbox and delivery ledger
  - advice decision store
  - audit and immutable receipts
  - data egress policy
 |
 v
MySQL
```

Gateway 只能调用 Helm application service。禁止工具 handler 直接拼 SQL、跳过 workspace
检查、把 `CaioMandateRecord` 当权限令牌，或自行实现第二套建议决策状态机。

## 8. 内网部署边界

### 8.1 地址与端口

- Mac Studio 使用 DHCP reservation 或客户批准的固定内网地址；
- 内部 DNS 或 mDNS 提供稳定名称，例如 public-safe 示例 `helm-caio.local`；
- Gateway 使用独立 HTTPS 端口，例如 `8443`；
- Next.js 开发端口 `3000` 不作为 WorkBuddy 集成端点；
- 生产 Gateway 不与人工桌面会话共享开发进程；
- 路由器不得配置公网端口转发。

### 8.2 网络限制

- macOS 防火墙和客户网络 allowlist 只允许登记的 CEO 设备访问 Gateway；
- Gateway 只绑定批准的 LAN interface，不提供公网监听；
- 离开公司 LAN 时，WorkBuddy 返回明确 `NETWORK_UNREACHABLE`；
- 不允许回退到 HTTP、公网、共享文件、数据库直连或临时 SSH tunnel；
- LAN 被称为“可信”不等于身份已经成立，所有请求仍必须通过双向 TLS 和应用授权。

### 8.3 后续远程传输兼容

未来加入 Tailscale/WireGuard 时：

- 保留相同 MCP tool schema、scope、挑战、数据投影和回执；
- 仅增加批准的网络 interface、DNS 和证书 SAN；
- 重新执行网络、证书、撤销、性能和故障验收；
- 不因处于 Tailnet 自动扩大业务权限。

## 9. 身份、认证与授权

### 9.1 设备身份

- CEO macOS 注册唯一 `clientId` 和设备证书；
- 私钥保存在 macOS Keychain / Secure Enclave，可行时设置 user-presence；
- Mac Studio 持有独立服务证书；
- Gateway 双向验证证书链、有效期、用途和撤销状态；
- 设备丢失、转让或疑似泄露时立即撤销，不等待证书自然过期。

真实证书、私有域名、内网地址和签发回执属于 Control Plane / private deployment，
不得进入 `helm-public`。

### 9.2 CEO 主体绑定

设备身份不能替代 CEO 身份。提交决定时必须同时满足：

1. 有效的设备身份；
2. 有效应用 scope；
3. 已认证 Helm user；
4. 当前 workspace 的 live `CaioPrincipalBinding`；
5. binding 的 `principalKind` 为 CEO；
6. `principalRef` 与 governing mandate 的 `ceoRef` 一致；
7. 现有 governed-action permission / policy gate 通过。

`WorkspaceRole.OWNER`、设备证书、WorkBuddy 登录或 CAIO 品牌都不能单独证明法律意义上的
CEO 身份。

### 9.3 应用 scope

第一阶段只签发：

```text
caio:status:read
caio:brief:read
caio:evidence:read
caio:question:read
caio:question:ask
caio:question:answer
caio:review:read
caio:review:prepare
caio:review:submit
```

禁止签发：

```text
execute
external_send
crm_write
connector_activate
mandate_issue
guardian_resume
database_access
filesystem_access
```

### 9.4 人在回路

- 读取工具不要求每次 Touch ID；
- `question:answer` 与 `review:submit` 使用两阶段 prepare/submit；
- prepare 返回绑定 workspace、对象、版本、动作、摘要 hash 和过期时间的短期 challenge；
- WorkBuddy 必须把最终写入内容展示给 CEO；
- submit 需要 CEO 通过 Touch ID 或 macOS user-presence 解锁本地签名；
- 模糊语句如“可以”“看着办”不能转换为 submit；
- challenge 一次性使用，过期、跨对象、跨 workspace、跨版本或重放均拒绝。

## 10. 数据出域与 WorkBuddy 信任边界

WorkBuddy 是交互客户端和外部 agent surface，不是 Helm 的受信业务数据平面。WorkBuddy
模型是否本地运行、调用何种 provider，不能由 Helm 默认推断。

### 10.1 返回 WorkBuddy 的内容

只有符合客户批准策略的 `remote_projected` 内容可以进入 WorkBuddy tool result：

- 最小化字段；
- 别名化主体；
- 脱敏后的事实和证据摘要；
- 时效、置信度、冲突和盲区；
- opaque evidence ref；
- 是否需要回到 Helm 本地界面的标记。

### 10.2 禁止返回的内容

- `local_only` 原文；
- restricted 原始证据；
- 原始附件和员工文件；
- connector secret、token、cookie、内部凭据；
- 完整个人信息或非必要金额明细；
- 本地占位符映射表；
- 未通过分类、授权或投影策略的数据。

无法安全投影时，Gateway 返回：

```json
{
  "available": false,
  "reason": "LOCAL_VIEW_REQUIRED",
  "evidenceRef": "opaque-ref",
  "requiresLocalView": true
}
```

### 10.3 外部内容与提示注入

- Gateway 返回结构化 JSON，不把证据文本当作工具指令；
- 从来源系统读取到的命令、链接或“忽略规则”等文本按不可信内容处理；
- 提示注入或异常上下文进入 quarantine，不发送 WorkBuddy；
- WorkBuddy 生成的总结、revision wording 或新建议只是 candidate；
- 只有经过 user-presence 签名的有限枚举决定才可作为 CEO 决策输入。

### 10.4 CEO 在 WorkBuddy 中输入的问题

CEO 输入在到达 Helm 前可能已经进入 WorkBuddy 选择的模型。因此第一阶段只允许在
WorkBuddy 中讨论客户批准进入该 provider 的内容。需要 `local_only` 原文的问题必须回到
Helm 本地控制面提出；Helm 不通过返回值补齐这条边界。

## 11. MCP 工具契约

所有工具返回统一 envelope：

```ts
type ToolEnvelope<T> = {
  ok: boolean;
  requestId: string;
  serverTime: string;
  data: T | null;
  error: null | {
    code: string;
    message: string;
    retryable: boolean;
  };
  boundary: {
    authorityEffect: "none";
    externalExecutionAllowed: false;
    projection: "remote_projected" | "metadata_only";
  };
};
```

### 11.1 读取与主动提问

| Tool | 作用 | 关键边界 |
|---|---|---|
| `get_caio_status` | 设备、服务、来源覆盖和盲区摘要 | 不返回内部日志或凭据 |
| `get_ceo_brief` | 今日事实、风险、阻塞和待判断摘要 | 展示数据截止时间 |
| `ask_caio` | 创建 owner-initiated question run | 输入和 scope 都需验证 |
| `get_caio_answer` | 返回 `EvidenceAnswerPacket` 投影 | facts/inferences/unknowns/conflicts 分离 |
| `continue_caio_question` | 在相同或更窄 evidence scope 下追问 | 不静默扩大 scope |
| `query_evidence` | 下钻已授权 evidence ref | `local_only` 返回 metadata only |

`ask_caio` 对简单、本地可完成的问题同步返回；需要远程深度推理时返回 `questionRunId`，
并通过 `get_caio_answer` 读取进度。模型流畅度不得提高 evidence confidence。

### 11.2 主动投递队列

| Tool | 作用 | 关键边界 |
|---|---|---|
| `poll_ceo_prompts` | 按 severity、cursor 和 clientId 拉取投递 envelope | client initiated；不可反向控制 CEO 电脑 |
| `list_pending_ceo_prompts` | 读取待处理投递 | workspace-scoped |
| `get_ceo_prompt` | 按 typed object ref 展开问题、证据、盲区和时效 | 不复制底层业务对象 |
| `prepare_prompt_response` | 按底层对象能力生成回答预览与 challenge | 不改变对象状态 |
| `submit_prompt_response` | 提交补证据、稍后、拒答或对象允许的有限动作 | user-presence + expectedVersion |
| `get_prompt_response_receipt` | 返回不可变回答回执 | 不构成执行许可 |

### 11.3 P1C 经营问题与 CEO 选择

| Tool | 作用 | 关键边界 |
|---|---|---|
| `get_operating_question_portfolio` | 投影当前有效的 10 题 Portfolio | 必须绑定 accepted G0 receipt version |
| `prepare_question_selection` | 预览 CEO 对 0-3 题的选择与修改 | 不写选择、不生成 Work Packet |
| `submit_question_selection` | 调用 P1C selection service | CEO binding + challenge + portfolio hash + expectedVersion |
| `get_question_selection_receipt` | 返回 `CaioQuestionSelectionReceipt` | 旧版本不可覆盖；无执行权限 |

P1C 工具必须直接消费 `CaioOperatingQuestionPortfolio`、
`CaioOperatingQuestionGenerationReceipt` 和 `CaioQuestionSelectionReceipt`。选中题目由
P1C service 绑定现有 `DecisionRecord` 并物化 `OperatingQuestionImplementationPlan`；
Gateway 不得自行创建第二套 selection、decision 或 implementation-plan 状态机。

### 11.4 建议复核

| Tool | 作用 | 关键边界 |
|---|---|---|
| `list_pending_caio_advice` | 读取等待 CEO 决定的 advice | 只返回合法且未过期项目 |
| `get_caio_advice_packet` | 建议、观察依据、未知、风险和期限 | 不提升为 commitment |
| `prepare_advice_decision` | 生成接受/拒绝/延期/要求修改预览 | 不改变 advice |
| `submit_advice_decision` | 复用 `decideCaioAdvice` 写决定 | CEO binding + challenge + expectedVersion |
| `get_advice_decision_receipt` | 返回 `CaioAdviceDecisionReceipt` | `authorityEffect: "none"` |

## 12. 主动投递模型

### 12.1 逻辑记录

WorkBuddy 集成只新增投递 envelope 与 ledger；底层问题、建议、决定和监督信号继续使用
各自的 canonical object。这里是领域设计，不是最终 Prisma schema：

```ts
type CaioQuestionDeliveryEnvelope = {
  deliveryObjectId: string;
  workspaceId: string;
  source: {
    objectKind:
      | "operating_question_candidate"
      | "caio_advice"
      | "decision_record"
      | "supervision_signal";
    objectId: string;
    objectVersion: number;
    objectHash: string;
  };
  deliveryKey: string;
  severity: "critical" | "normal";
  category: string;
  triggerRuleRef: string;
  triggerSnapshotHash: string;
  validUntil: string;
  deliveryVersion: number;
  status:
    | "pending"
    | "delivered"
    | "opened"
    | "answered"
    | "snoozed"
    | "declined"
    | "withdrawn"
    | "expired";
};
```

另有 delivery ledger、response receipt、suppression rule 和 one-time challenge。envelope
不复制标题、问题正文、options、facts、inferences、unknowns 或 evidence refs；这些字段
在读取时由 canonical object 经 projection policy 生成。真实记录必须 workspace-bound；
跨 workspace 引用在 schema 和 service 两层都要失败。

### 12.2 生命周期

```text
PENDING -> DELIVERED -> OPENED -> ANSWERED
                    \-> SNOOZED -> PENDING
                    \-> DECLINED
PENDING/DELIVERED/OPENED/SNOOZED -> WITHDRAWN
PENDING/DELIVERED/OPENED/SNOOZED -> EXPIRED
```

终态不能恢复。canonical object 出现新版本时形成新的 delivery version；不得覆盖已签名
历史回执，也不得通过投递层修改 P1C Portfolio 或 selection 历史。

### 12.3 严重度

严重度只能由已登记的确定性 trigger rule 产生。模型可以提出 severity candidate，但不能
自行把普通问题升级为 critical。critical rule 至少记录：

- threshold；
- duration；
- scope；
- evidence requirement；
- false-positive handling；
- owner；
- version；
- activation receipt。

法律、政策、人员同意或授权明确阻断的动作直接停止，不得包装成“是否绕过”的 CEO 问题。

## 13. 推送与主动提问流程

### 13.1 WorkBuddy 调度

- 一个 urgent poll 每分钟调用 `poll_ceo_prompts(severity=critical)`；
- 一个 digest poll 每三十分钟调用 `poll_ceo_prompts(severity=normal)`；
- 两条任务共享 client cursor 和 delivery ledger；
- urgent 已投递的问题不会再次进入普通 digest；
- WorkBuddy 在固定的 `Helm CAIO` workspace 中展示问题；
- 第一阶段不依赖手机、Bot 或外部通知渠道。

若 WorkBuddy 当前版本不能提供稳定的一分钟 native automation，允许用 public-safe、签名的
macOS LaunchAgent helper 触发同一只读 poll tool；该 helper 不能获得 submit scope。

### 13.2 去重与防打扰

- `(workspaceId, deliveryKey, deliveryVersion, clientId)` 只能形成一次有效 delivery；
- trigger snapshot 没变化时不得新建版本；
- snooze 窗口内不再投递；
- expired、withdrawn、answered 和 declined 不再投递；
- suppression rule 必须限定 category、范围和有效期，可撤销；
- 不允许模型通过改写标题绕过 canonical object ref、object hash 或 deliveryKey 去重。

### 13.3 主动提问

1. CEO 在 WorkBuddy 输入问题；
2. WorkBuddy 调用 `ask_caio`，不自行生成“Helm 已确认”的答案；
3. Gateway 校验 scope、输入长度、workspace 和数据策略；
4. Helm 形成 `OwnerQuestionPacket`；
5. 回答按 `EvidenceAnswerPacket` 验证与投影；
6. WorkBuddy 保持 facts、inferences、unknowns 和 conflicts 的视觉分区；
7. 后续追问不得静默扩大 evidence scope；
8. 转为 advice/review 时只创建候选，不直接提交决定。

## 14. 复核流程

```text
list/get advice
 -> prepare decision
 -> WorkBuddy displays exact final write
 -> CEO confirms with Touch ID / user-presence
 -> submit signed challenge + expectedVersion + idempotencyKey
 -> Gateway revalidates auth, binding, mandate, advice status and expiry
 -> decideCaioAdvice
 -> immutable decision receipt
```

服务端必须重新校验全部条件，不能相信 WorkBuddy 已经展示或确认。并发提交：

- 相同 advice、outcome 和 reason 返回原回执；
- 不同 outcome 或 reason 冲突时拒绝；
- advice 同时撤回或过期时只允许一个合法状态转移；
- 客户端收到 timeout 后先按 idempotencyKey 查询回执，不盲目重放。

## 15. 错误处理

| Code | 场景 | 客户端处理 |
|---|---|---|
| `NETWORK_UNREACHABLE` | 不在同一 LAN 或 Gateway 不可达 | 明确离线，不回退 |
| `DEVICE_UNTRUSTED` | 证书未知、撤销或用途不符 | 停止全部工具 |
| `AUTH_EXPIRED` | 应用会话过期 | 重新认证，不缓存决定 |
| `SCOPE_DENIED` | 工具不在 scope 内 | fail closed |
| `CEO_BINDING_REQUIRED` | 无 live CEO principal binding | 禁止 submit |
| `LOCAL_VIEW_REQUIRED` | 数据不可投影到 WorkBuddy | 只显示 metadata |
| `EVIDENCE_STALE` | 证据过时 | 降级或阻断复核 |
| `VERSION_CONFLICT` | 问题/advice 已变化 | 重新读取，不自动提交 |
| `OBJECT_WITHDRAWN` | 问题/advice 已撤回 | 关闭本地卡片 |
| `OBJECT_EXPIRED` | 超过有效期 | 禁止回答/决定 |
| `CHALLENGE_EXPIRED` | prepare challenge 过期 | 重新 prepare |
| `REPLAY_REJECTED` | nonce/challenge/idempotency 异常 | 报告安全错误 |
| `PROJECTION_BLOCKED` | 敏感度、授权或提示注入不允许 | 隔离，不发送 |
| `WRITE_UNAVAILABLE` | Helm 无法写入回执 | 显示失败，不本地排队补交 |

## 16. 可观测性与审计

记录：

- requestId、clientId、certificate fingerprint；
- workspace、user、CEO principal ref；
- tool、scope、对象 ref 和 expectedVersion；
- request/response projection class；
- challenge、idempotencyKey 和结果；
- delivery、opened、snooze、answer、decision 和 receipt ref；
- latency、错误码和安全拒绝；
- policy、schema、tool 和 connector 版本。

不记录：

- 私钥、token、cookie 或完整证书材料；
- 未治理的业务原文；
- local-only evidence；
- WorkBuddy 模型 prompt 全文；
- 原始附件；
- 可逆的别名映射。

审计记录证明发生了什么，不自动证明建议正确、客户已接受、生产已就绪或外部动作已完成。

## 17. 功能开关与分阶段启用

建议独立开关：

```text
CAIO_WORKBUDDY_GATEWAY_ENABLED
CAIO_WORKBUDDY_READ_ENABLED
CAIO_WORKBUDDY_PUSH_ENABLED
CAIO_WORKBUDDY_MUTATIONS_ENABLED
```

启用顺序：

1. **Read-only**：status、brief、ask、answer projection；
2. **P1C portfolio read**：读取 10 题 Portfolio 与 generation receipt；
3. **Proactive delivery**：typed outbox、urgent poll、digest、delivery ledger；
4. **Responses and selection**：prepare/submit prompt response 与 0-3 题选择；
5. **Advice review**：prepare/submit advice decision；
6. **Remote transport later**：Tailscale/WireGuard 独立验收。

任何后序开关不得暗示前序开关或业务权限自动成立。

## 18. 自动测试

### 18.1 契约与权限

- 每个 MCP tool 的 schema、枚举、大小限制和 envelope；
- workspace 隔离；
- scope 矩阵；
- OWNER 不等于 CEO；
- revoked principal binding；
- mandate 无效、暂停、撤销和过期；
- WorkBuddy content 永远不是权限令牌。

### 18.2 身份与网络

- 未登记设备、过期证书、撤销证书、错误 EKU；
- 错误 hostname、明文 HTTP、公网 interface；
- nonce 重放、时间偏差、challenge 复用；
- 离开 LAN 后明确不可达且无 fallback；
- 证书轮换和服务重启。

### 18.3 数据投影

- `local_only` 和 restricted 原文零返回；
- remote projection 最小化与别名化；
- 无分类、无授权、过期授权和跨 workspace 证据拒绝；
- prompt injection 隔离；
- tool error、audit 和日志不泄露原文或凭据。

### 18.4 主动提问与推送

- active ask -> `OwnerQuestionPacket` -> `EvidenceAnswerPacket`；
- accepted G0 -> generation receipt -> 恰好 10 题 Portfolio；
- insufficient evidence -> 缺口报告且无可选 Portfolio；
- WorkBuddy 读取 canonical P1C candidate，不创建第二套 question；
- CEO 选择 0-3 题 -> versioned selection receipt -> existing `DecisionRecord`；
- facts/inferences/unknowns/conflicts 保持分区；
- critical 一分钟目标；
- normal 三十分钟 digest；
- typed object ref、object hash、cursor、delivery ledger、snooze、suppression 去重；
- withdraw/expire/answer 与 poll 并发；
- WorkBuddy 离线恢复后不重复投递已确认 delivery。

### 18.5 回答与复核

- prepare 不修改状态；
- Touch ID/user-presence 取消不写入；
- 相同提交幂等；
- 不同提交冲突；
- answer/review 与撤回、过期、mandate 停止并发；
- timeout 后按 idempotencyKey 查原回执；
- accepted advice 仍为 `authorityEffect: "none"` 且无 execution ref。

### 18.6 端到端

在真实两台 macOS、同一 LAN、腾讯 WorkBuddy、Mac Studio、MySQL 上验证：

1. 设备注册与证书信任；
2. 主动提问与证据投影；
3. critical 与 normal 问题出现；
4. 回答、补证据、snooze、decline；
5. advice prepare/Touch ID/submit/receipt；
6. LAN 断开、服务重启、证书撤销；
7. WorkBuddy 更新与 Skill 重装后 scope 不扩大；
8. 全链路审计可按 requestId 和 receiptRef 追溯。

## 19. 验收指标

| 指标 | 第一阶段门槛 |
|---|---|
| 常见本地证据查询 P95 | <= 5 秒目标，以试点规模压测校准 |
| critical 问题呈现 | 目标 <= 60 秒 |
| normal digest | 目标 <= 30 分钟 |
| 重复有效 delivery | 0 |
| 重复决定回执 | 0 |
| 未授权 workspace 读取 | 0 |
| local-only 原文进入 WorkBuddy | 0 |
| 失效证书成功调用 | 0 |
| 无 user-presence 的 mutation | 0 |
| advice decision 产生执行权限 | 0 |
| LAN 之外意外可达 | 0 |

## 20. 当前基线与并发门禁

在基线 `f1617fc` 上使用新建的隔离 MySQL 8.4 数据库验证：

- G0 initialization gate MySQL integration tests：7/7 通过；
- Stage 1 owner loop：7/8 通过；
- 先前的 observation/connection failure、observation/authorization revocation、
  source registration/program revocation 和 decision-evaluation replay 四项竞态均已通过；
- `recordExecutionReceipt` 与 `verifyExecutionReceipt` 并发测试仍失败：最终状态可能从
  `VERIFIED` 降为 `SELF_REPORTED`；单测定向重跑仍可复现。

这项剩余缺陷不阻塞入口勘察、契约设计、read-only projection 或 P1C Portfolio 读取，但它
证明当前 receipt mutation 基线还不能支撑新增远程 mutation surface。因此：

- P1C 入口勘察、G0、read-only 与问题展示可以继续；
- `CAIO_WORKBUDDY_MUTATIONS_ENABLED` 默认保持 false；
- 启用 question response、P1C selection 或 advice decision 前，execution receipt 失败必须
  修复并在 MySQL 8.4 隔离库全绿；
- 新增的 portfolio generation、selection、delivery 和 advice 并发测试也必须全绿；
- 不能用默认跳过 integration tests 的全量 Vitest 结果替代隔离 MySQL 证据。

## 21. P1C 双机协调边界

### 21.1 另一台机器：P1C 核心负责人

另一台机器只负责 P1C canonical domain：

- 定位 `OwnerQuestionPacket`、`EvidenceAnswerPacket`、`DecisionRecord` 与 CEO Console 的
  真实入口；
- 形成 symbol-level reuse map；
- 实现或完善 Portfolio、generation receipt、0-3 题 selection、selection receipt；
- 选中题目绑定现有 `DecisionRecord`，不创建第二套决策对象；
- 覆盖 G0、恰好 10 题、证据不足 fail-closed、CEO binding、portfolio hash、版本与并发测试。

交付必须使用独立分支，建议
`codex/caio-pro-p1c-portfolio-selection-20260723`，基于 `f1617fc`。交付物至少包含：

| 字段 | 要求 |
|---|---|
| Symbol | 类型、validator、service、route/UI 入口和测试名 |
| File | 仓库内准确路径 |
| Current semantics | 当前真实行为，不只写计划文档 |
| Verdict | reuse / extend / missing |
| Missing seam | P1C 所需的最小新增接口 |
| Evidence | 测试命令、结果和 commit hash |

另一台机器不得在 P1C 核心提交中实现 WorkBuddy Skill、MCP Gateway、delivery outbox、
设备证书或远程投影策略。

### 21.2 本机：协调与集成负责人

本机负责：

- 冻结跨域契约、权限、投影、投递、回执和 LAN 边界；
- 审阅 P1C reuse map 与 commit，检查是否重复建模；
- 为 WorkBuddy/Gateway 制定 typed object ref 和 tool contract；
- 维护集成测试矩阵、并发门禁、文档和四仓所有权；
- P1C commit 验收通过后再安排集成，不在对方工作期间修改同一批 runtime 文件。

集成前必须先 fetch 对方独立分支、检查 diff 与测试证据，再决定 cherry-pick、merge 或要求
拆分。两台机器不得同时向同一个共享开发分支直接提交。

## 22. 四仓所有权

| 仓库 | 所有权 |
|---|---|
| `helm-public` | public-safe MCP contracts、projection validators、question/advice review-first services、synthetic fixtures、reference adapter 和测试 |
| `helm-packs` | 行业问题分类、trigger templates、通用证据映射；不持有设备凭据 |
| `helm-overlays` | 私有 CEO identity binding、客户 LAN/DNS/数据投影策略、真实来源与模型 allowlist |
| `helm-control-plane` | 设备注册、证书签发/轮换/撤销、部署、端口、防火墙、版本 pin、健康、回滚和生产回执 |

WorkBuddy 的 public-safe reference Skill 可以作为公开适配样板，但真实 client config、证书、
客户 hostname、workspace id 和授权材料不得进入 `helm-public`。

## 23. 交付阶段

### A. P1C 入口图与 canonical core

- 完成 symbol-level reuse map；
- 固化 Portfolio、generation receipt、selection receipt 和 implementation plan 边界；
- 复用 `OwnerQuestionPacket`、`EvidenceAnswerPacket` 与 `DecisionRecord`；
- G0、证据不足、10 题、0-3 题、版本和并发测试。

### B. WorkBuddy read-only slice

- MCP envelope、tool schema、error codes；
- device/client/principal authorization contract；
- projection policy；
- status、brief、ask、answer 与 P1C Portfolio read；
- synthetic WorkBuddy fixture 与离线 eval。

### C. Typed delivery outbox

- canonical object ref 与 projection resolver；
- delivery ledger、cursor、dedup、snooze、suppression；
- critical 和 digest polling；
- read-only WorkBuddy reference adapter。

### D. mutation hardening

- one-time challenge；
- Keychain/Secure Enclave user-presence helper；
- prompt response 与 P1C selection receipts；
- advice decision reuse；
- concurrency、replay 和 revocation tests；
- mutation flag 保持默认关闭直到所有门禁全绿。

### E. LAN pilot

- 两台 macOS 的证书和网络配置；
- 真实 WorkBuddy Skill 安装；
- LAN-only E2E；
- rollback、证书撤销和恢复演练；
- 客户 private acceptance receipt。

### F. remote transport later

- Tailscale/WireGuard 选型；
- remote ACL、DNS、certificate SAN 和性能；
- 不改变业务 tool contract；
- 独立设计评审和验收。

## 24. 回滚

- 先关闭 `CAIO_WORKBUDDY_MUTATIONS_ENABLED`；
- 再关闭 push/read 开关；
- 撤销 CEO 设备证书与应用 scope；
- 停止 Gateway，不停止 CAIO 本地只读控制面；
- 保留已签名历史回执和审计；
- 不删除已回答问题或已决定 advice；
- WorkBuddy reference Skill 可以卸载，但卸载不是 Helm 侧撤权的替代。

## 25. 公开能力分级

### 已经完整成立

- 本设计中的需求决策和边界已经由用户确认；
- 现有 CAIO advice decision 契约保持 `authorityEffect: "none"`；
- 现有 question/evidence contract 可作为主动问答基础。

### 已成形但仍需下一层

- WorkBuddy + MCP Gateway 架构；
- canonical 主动问题与 typed delivery outbox；
- LAN 设备身份、mTLS 和 Touch ID mutation；
- 数据投影与 WorkBuddy provider 边界；
- 两台 macOS 的端到端验收。

### 刻意未做

- 手机与 IM；
- Tailscale/WireGuard；
- 公网入口；
- 外部执行；
- 通用多客户端或多 CEO 设备支持。

### 风险项

- WorkBuddy provider 可能看到 CEO 输入和 tool projection；
- WorkBuddy automation 的最小调度周期与后台稳定性需在真实版本验证；
- LAN 设备寻址、证书 SAN 和睡眠策略需现场验证；
- 当前基线仍有一个 execution receipt verification 并发失败；
- Touch ID helper 与 WorkBuddy Skill 的交互需要真实 macOS 验收。

## 26. 验证命令基线

实施阶段至少运行：

```bash
npm run check:stage1-owner-loop
npm run check:caio-terminology
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

此外必须显式设置隔离 MySQL 8.4 URL 运行 Stage 1、CAIO governance、P1C portfolio /
selection、delivery outbox 和 Gateway integration tests；不能依赖默认 skip。

## 27. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-23 | 对齐 P1C canonical objects：WorkBuddy 复用 Portfolio、question/evidence packet 与 DecisionRecord，只新增 typed delivery envelope；冻结双机分支、交付和集成边界；记录最新 MySQL 门禁。 |
| 2026-07-23 | 冻结腾讯 WorkBuddy + CEO macOS + Mac Studio + LAN-only MCP Gateway；支持 CEO 主动提问与 CAIO 主动问题，critical 一分钟、normal 三十分钟；手机和 Tailscale 延后。 |
