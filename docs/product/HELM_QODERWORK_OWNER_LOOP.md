---
status: implemented_default_off
owner: helm-core
created: 2026-07-20
review_after: 2026-08-20
public_safety: Public Core contract and synthetic proof only. No tenant credential, source content, runtime activation, or production deployment is established.
---

# Helm × QoderWork 一把手经营闭环

## 1. 产品边界

QoderWork 是员工桌面侧的受限资源与草稿助手；Helm 是唯一的经营判断、批准、监督和公司记忆治理终端。首个公共参考场景是商机推进督办：

```text
受权来源 → QoderWork 证据提案 → Helm 外部候选账本
→ DecisionRecord → Owner 复核 → 唯一 Work Packet
→ QoderWork 跟进草稿 → 人工执行 → 独立回执验收
→ Decision Evaluation → OBSERVED Memory 候选
```

外部提案不是事实，OBSERVED 候选不是 ACTIVE Memory，经营上下文是确定性只读投影。没有 held-out 评测、长期结果反馈和可复现因果证据时，不使用“企业世界模型”声明。

## 2. 复用的 Core 基座

本切片不创建平行治理体系，复用：

- External Agent Intake：外部产物契约、provider registry 和接纳 / 降级 / 隔离 / 拒绝评估。
- Stage 1 Owner Loop：观察计划、DecisionRecord、唯一 Work Packet、监督、结构化回执、独立验收与评估。
- Enterprise Operating Context：可重放、无动作权的时间化经营上下文。
- ExternalMemoryRecord：`QODERWORK` 外部候选账本；QoderWork 不能直接创建正式 Memory。

## 3. MCP 公共契约

入口为单一 Streamable HTTP endpoint：

```text
POST /api/mcp/qoderwork
Authorization: Bearer <one-time-device-token>
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-11-25
```

当前协议协商兼容 `2025-11-25`、`2025-06-18` 和 `2025-03-26`。实现遵循 MCP Streamable HTTP 的单 endpoint 语义；无服务端事件流时 GET 明确返回 405。

工具闭集：

| 类型 | 工具 | 权限 |
|---|---|---|
| 读取 | `get_context_pack` | `context:read` |
| 读取 | `list_decision_objects` | `decision:read` |
| 读取 | `get_work_packet` | `work-packet:read` |
| 读取 | `get_supervision_summary` | `supervision:read` |
| 提案 | `propose_evidence_manifest` | `evidence:propose` |
| 提案 | `propose_draft_artifact` | `draft:propose` |
| 提案 | `propose_receipt_candidate` | `receipt:propose` |

不存在 `approve`、`send`、`execute`、`write_crm`、`promote_memory`、`change_policy` 或 `activate_automation` 工具。客户端不能声明 workspace、tenant、user 或 device 身份；这些字段由设备凭证在服务端派生。

所有读取请求必须携带明确的 `objectRef`，服务端同时校验连接允许的对象类型，并只返回与该对象引用精确绑定的 internal 级治理投影。Work Packet 读取、草稿和回执候选还必须证明该 Packet 的 DecisionRecord 绑定同一对象引用；无法证明时 fail closed。

统一业务响应包含 `status`、`requestRef`、`correlationRef`、`acceptedArtifactRefs`、`receiptRef`、`warnings` 和 `nextAllowedSurface`。同 idempotencyKey + 同内容返回原回执；同键异内容返回 `CONFLICT` 并写不可变冲突审计。

参考：

- [MCP 2025-11-25 lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [QoderWork MCP 配置](https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/user-guide/mcp)
- [QoderWork Skills](https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/user-guide/skills)

### 客户端兼容性登记

| 客户端 | 当前证据 | 姿态 |
|---|---|---|
| QoderWork CN 0.9.12 | 2026-07-20 本机安装版本；仅完成 Skill 文件安装与公共契约验证 | 不构成云端联通或版本放行 |
| 其他 / 后续版本 | `initialize.clientInfo` 会记录受限的客户端名称与版本 | 必须重新跑 MCP 合同与合成 E2E；服务端不硬编码单一客户端版本 |

兼容性以 MCP 协议版本、闭合工具 schema 和测试回执为准，不以桌面应用“已安装”推导。当前未配置真实 endpoint 或设备 Token。

## 4. 设备连接与安全

`ExternalAgentConnection` 是通用的外部 Agent 设备连接模型。QoderWork 使用 `providerId=qoderwork_cn`，一条连接绑定一个 workspace、一个用户、一台设备和一个有效观察计划。

- Token 使用 32 随机字节，只显示一次；数据库只保存 SHA-256 哈希和不可用于认证的短前缀。
- 默认 30 天；轮换立即让旧 Token 失效；OWNER / ADMIN 可撤销。
- 每设备每分钟 60 次，单请求最大 1 MiB。
- 来源必须处于同 workspace 的有效 EnterpriseObservationProgram，且 source 为 ACTIVE + READ_ONLY。
- absolute path、凭证、原文和内部异常不进入日志或安全错误响应。
- 提案摘要中的常见邮箱、手机号、身份证号、Bearer / 私钥片段和本地绝对路径在入账前确定性阻断；内容哈希必须是完整 SHA-256。
- 浏览器 Origin 必须命中明确 allowlist；无 Origin 的桌面客户端仍需 Bearer 身份。
- 第三方资料中的提示词不改变工具闭集、scope、来源或数据等级。

部署与 workspace 两个开关必须同时为真：

```env
HELM_QODERWORK_MCP_ENABLED=false
HELM_MCP_ALLOWED_ORIGINS=
```

workspace feature flag 为 `qoderworkOwnerLoopMcp`。任一开关缺失时入口 fail closed。连接记录可以提前准备，但不代表 runtime 已激活。

## 5. 数据分级与保留

| 等级 | QoderWork 行为 | Helm 入账 |
|---|---|---|
| public / internal | 授权范围内处理，提交受治理摘要 | 摘要、opaque ref、哈希、时效、证据引用 |
| confidential | 仅已审核模型配置；提交前脱敏 | 脱敏摘要和治理元数据 |
| restricted | 普通模型上下文阻断 | 只允许固定 `restricted-metadata-only` 标记 + metadata + 完整 SHA-256 |

密钥、身份凭证、完整合同、身份证件和高敏个人信息默认阻断。外部候选默认保留 30 天；不可变审计 / 回执目标保留 180 天；正式 Memory 遵循租户政策。清理任务与生产存储策略属于部署层，不由该公共代码切片宣称成立。

## 6. 产品界面

- `/settings`：OWNER / ADMIN 创建设备连接、选择观察计划和来源、设置最高数据等级、轮换与撤销；Token 只显示一次。
- `/dashboard`：显示有效设备、候选、待复核、隔离、冲突和最新证据时间。
- `/approvals`：OWNER 决策抽屉显示事实、推断、未知、风险、引用、有效期和 Qoder 草稿预览。批准生成唯一 Work Packet；拒绝、延后、要求补证记录结构化治理结果。
- `/memory`：QoderWork 外部候选单独显示并明确不是 ACTIVE Memory。

## 7. QoderWork Skill

公共模板位于 `integrations/qoderwork/skills/helm-owner-loop/SKILL.md`，包含三个触发任务：

1. 整理这个商机的最新证据。
2. 检查这个商机还缺什么信息。
3. 根据 Helm 已确认的 Work Packet 生成跟进草稿。

Skill 每次必须展示读取范围、拟提交摘要、原文留存姿态和无批准 / 发送 / 执行 / 正式写入权限。安装 Skill 不等于 MCP 连接、设备凭证或 runtime 激活。

## 8. 当前实现真值

已实现的是 Public Core 代码、数据库迁移、关闭状态的 MCP runtime、设置 / Dashboard / Approvals / Memory 界面和 synthetic / unit proofs。尚未由本仓单独证明：

- Helm-self Overlay 已获 owner 授权；
- 设备 Token 已创建并写入 QoderWork；
- 云端 endpoint 已部署可达；
- 真实来源或业务数据已接入；
- 180 天生产保留任务已配置；
- 试点指标已经达标；
- 任何客户租户已经激活。
