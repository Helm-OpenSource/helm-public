---
status: active
owner: helm-core
created: 2026-06-08
review_after: 2026-07-08
public_safety: Public-safe permission policy contract only. No customer names, tenant policy data, private domains, credentials, deployment receipts, production authorization proof, external send, writeback, approval execution, or customer commitment.
---
# Helm Permission Policy Contract / Helm 权限策略契约

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位

本文件把 Helm 权限管理需求定稿为可实施契约。它承认当前 Core 已有 workspace 级
membership、role capability 和 `workspaceId` ownership guard，但这些只是不越过工作区边界的
底座，不足以覆盖行业 Pack 与租户 Overlay 的细粒度权限。

Helm 下一层权限体系必须支持：

- 同一组织内不同人员、工作区角色、业务角色、组和服务 actor 的不同可见性与操作权限。
- 行业 Pack 声明自己的业务资源、动作、风险等级、数据分类和默认效果模式。
- 私有 Overlay 绑定租户自己的组织角色、人员、资源范围、字段脱敏、审批回执和写回 gate。
- 所有未知资源、未知动作、缺失策略、缺失绑定、inactive membership、缺失 service scope、
  跨 workspace 访问默认拒绝。
- 权限决策必须可审计、可回放、可解释，并能区分 routing、recommendation、review 和 authorization。

本文件不是完整企业 IAM、不是 marketplace 权限系统、不是插件 sandbox、不是生产授权证明、
不是客户部署批准，也不授予自动外发、自动写回、自动审批或高风险状态变更权限。

## 2. 当前事实

| Existing fact | Meaning | Requirement impact |
| --- | --- | --- |
| `WorkspaceRole` capability matrix | Core 已能控制平台级成员、设置、导入、记忆、runtime、审批等能力 | 保留为 Core base capability，不替代业务权限 |
| `workspaceId` ownership guard | Core 记录普遍按当前 workspace 隔离 | 继续作为所有权限判断的前置边界 |
| `WorkspaceSolutionExtension` | 当前主要表达 workspace 是否启用 extension | 必须升级为 subject-aware access，不得只靠 enablement |
| Solution Extension protocol | 依赖方向是 `Core SDK <- Pack SDK <- Overlay` | Core 不能 import Pack / Overlay；Pack / Overlay 只能通过契约提供声明 |
| Runtime permission fencing | LLM capability 请求 fail-closed 到 read/draft/review/blocked side-effect | 权限体系必须复用 side-effect 边界，不创建 LLM 特权通道 |
| Review-first approval posture | 高风险动作必须人审，建议不等于承诺 | 业务权限允许动作不等于自动执行动作 |

## 3. 非目标

本轮权限体系不得实现或暗示：

- 完整企业级多组织 / 多权限 / 多租户平台。
- 客户专属人员、组织结构、队列、域名、凭据、部署状态或生产授权进入 `helm-public`。
- Core 反向依赖 Pack、Overlay 或私有 control-plane。
- 自动写回客户系统、自动外发、自动审批、自动结算、自动高风险状态推进。
- 用 `rolePresetKey`、persona、supervisor mapping 或 notification target 代替 authorization。
- 只在 UI 层隐藏字段，却让 API / export / background job 泄漏字段。
- 用 green build、green guard 或 local dry-run 声称生产租户 permission readiness。

## 4. 权限模型

### 4.1 Subject

`PermissionSubject` 表示谁在请求权限。

```ts
type PermissionActorType = "user" | "service" | "system";

type PermissionSubject = {
  actorType: PermissionActorType;
  workspaceId: string;
  userId?: string;
  membershipId?: string;
  workspaceRole?: WorkspaceRole;
  rolePresetKey?: string | null;
  serviceKey?: string;
  serviceScopes?: string[];
  policyVersion?: string;
  auditSource?: "session" | "delegated_service" | "system_guard" | "synthetic_fixture";
};
```

规则：

- `user` actor 必须有 `ACTIVE` membership；如果 invite auto-activation 发生，权限判断必须重新确认
  当前 membership 已经 active。
- `service` actor 必须有显式 service key、显式允许的 delegated scope、policy version 和 audit source；
  delegated scope 必须包含当前 action name 或显式 `*`，不能用“任意非空 scope”继承人类权限。
- `system` actor 只能用于 deterministic guard、validator 或 public-safe fixture，不得自动继承用户权限。
- `rolePresetKey` 只能作为 routing / onboarding signal，不是授权角色。
- 没有 `userId` 的 actor 不得因为不是 `USER` 就跳过权限检查；service / system 都必须显式声明 scope。

### 4.2 Resource

`PermissionResource` 表示要读取或操作什么。

```ts
type PermissionResource = {
  kind: string;
  workspaceId: string;
  resourceId?: string;
  extensionKey?: string;
  packKey?: string;
  dataClassifications?: PermissionDataClassification[];
  scope?: Record<string, string | string[]>;
};
```

规则：

- `workspaceId` 必须与当前 session / actor scope 一致。
- `kind` 必须来自 Core contract 或 Pack manifest。
- `resourceId` 为空时只能表示 list / aggregate / navigation scope，不能绕过 row-level policy。
- `scope` 只能存通用键值；真实租户队列、人员、区域、系统账户映射留在 Overlay。

### 4.3 Action

`PermissionAction` 表示请求做什么。

```ts
import { runtimePermissionProfileSchema } from "@/lib/llm/runtime-permission";

const permissionEffectModeSchema = runtimePermissionProfileSchema;

type PermissionEffectMode =
  | "read_only"
  | "draft_only"
  | "review_required"
  | "blocked_side_effect";

type PermissionRiskLevel = "low" | "medium" | "high" | "critical";

type PermissionAction = {
  name: string;
  effectMode: PermissionEffectMode;
  riskLevel: PermissionRiskLevel;
};
```

规则：

- `PermissionEffectMode` 必须直接复用 `runtimePermissionProfileSchema`；不得另建第三套 effect-mode enum。
- 未知 action 默认 `blocked_side_effect` 并拒绝。
- `read_only` 只允许读取授权范围内的数据，不允许导出未授权字段。
- `draft_only` 只能创建本地草案、候选、review packet 或 synthetic fixture。
- `review_required` 必须返回 approval / review obligation，不能直接执行。
- `blocked_side_effect` 永远不得由 public Core 执行。

### 4.4 Decision

`PermissionDecision` 表示最终判断。

```ts
type PermissionDecision = {
  effect: "allow" | "deny";
  reason: string;
  policyVersion: string;
  traceId: string;
  source: "core_default" | "workspace_role" | "pack_manifest" | "overlay_binding" | "control_plane_entitlement";
  actor: PermissionSubject;
  resource: PermissionResource;
  action: PermissionAction;
  failureCode?: PermissionFailureCode;
  obligations?: string[];
  redactions?: string[];
};

type PermissionFailureCode =
  | "no_session"
  | "inactive_membership"
  | "cross_workspace"
  | "missing_policy_version"
  | "policy_version_mismatch"
  | "unknown_action"
  | "missing_service_scope"
  | "workspace_capability_denied"
  | "data_class_denied"
  | "blocked_side_effect"
  | "no_policy_match";
```

规则：

- deny 优先于 allow。
- `failureCode` 必须是闭集 enum；`reason` 可以是人读字符串，但测试和审计聚合必须断言
  `failureCode`，不能依赖自由文本。
- 缺少 policy version 必须 deny。
- allow 不代表执行；如果 action 是 `review_required`，调用方仍必须进入复核 / 审批流。
- 敏感读取允许时仍可能带 `redactions`，调用方必须执行字段脱敏。
- `traceId` 必须能串联 allow / deny、调用入口、测试 fixture 和审计输出。
- decision / audit 不得包含 raw personal contact、regulated personal data、tenant private config 或客户系统 payload。

## 5. 数据分类

Core 提供闭合集合，Pack 可引用，Overlay 不得在 public Core 中新增客户专属分类。

| Classification | Meaning | Default |
| --- | --- | --- |
| `public_safe_synthetic` | 公开安全合成 / 脱敏 fixture | 可用于 public docs / tests |
| `workspace_internal` | 工作区内部普通经营信息 | active membership 后再看 action |
| `personal_contact` | 电话、邮箱、即时通讯账号等个人联系信息 | 默认 redact |
| `regulated_personal_data` | 身份证件、监管敏感个人信息 | 默认 deny，除非 Overlay binding |
| `financial_data` | 金额、回款、账期、账务、付款承诺 | 默认 deny，除非 Pack + Overlay 双授权 |
| `legal_sensitive` | 法务、争议、催告、合规风险信息 | 默认 deny，至少 review_required |
| `tenant_private_config` | 私有映射、账户、队列、写回配置 | 不进入 public Core；Overlay 私有处理 |

默认 redaction 映射必须复用 agentic governance 的闭集：

| Data classification | Default redaction |
| --- | --- |
| `public_safe_synthetic` | `synthetic` |
| `workspace_internal` | `redacted` |
| `personal_contact` | `alias_only` |
| `regulated_personal_data` | `raw_private_rejected` |
| `financial_data` | `raw_private_rejected` |
| `legal_sensitive` | `raw_private_rejected` |
| `tenant_private_config` | `raw_private_rejected` |

这张表是权限层与现有 diagnostics doctor-packet / agentic / source-intake 脱敏层之间的桥，不得再创建
一套新的 redaction 状态。私有 collection-project 的 sensitivity / financialSensitivity 只能在 Pack /
Overlay 映射到这些 public-safe data classifications 后再进入 Core evaluator。

## 6. Policy Source 顺序

权限评估顺序必须稳定：

1. **Session / actor precheck**：无登录、无 membership、无 service scope 直接 deny。
2. **Workspace ownership**：resource workspace 与 actor workspace 不一致直接 deny；入口不得只信任 caller
   传入的 `workspaceId`，必须由 session / actor scope 派生或复核。
3. **Core base capability**：平台级 action 使用现有 `WorkspaceRole` capability matrix。
4. **Extension enablement**：workspace 未启用 extension 直接 deny；启用不等于授权。
5. **Pack manifest**：Pack action / resource 必须声明 kind、action、risk、effect mode、data classification。
6. **Overlay binding**：私有租户人员 / 组 / scope / field policy / entitlement 在 Overlay 私有判断。
7. **Control-plane entitlement**：只作为部署 / 授权 metadata gate，不绕过 actor permission。
8. **Decision audit**：allow / deny 都要留下 policy version、source 和 reason。

任何一步未知、缺失、解析失败、超时、inactive membership、缺失 service scope 或 policy version
不匹配，默认 deny，并产生 typed decision reason。

## 7. Pack Manifest 要求

行业 Pack 可以声明通用行业对象，但不得包含租户真实数据。

最小 manifest shape：

```ts
type PackPermissionManifest = {
  schemaVersion: "helm.permission-manifest/v1";
  packKey: string;
  policyVersion: string;
  resources: Array<{
    kind: string;
    displayName: string;
    dataClassifications: PermissionDataClassification[];
    supportsRowFilters: true;
    fieldRedactions: Array<{
      field: string;
      dataClassification: PermissionDataClassification;
      defaultRedaction: RedactionStatus;
    }>;
  }>;
  actions: Array<{
    name: string;
    resourceKind: string;
    effectMode: PermissionEffectMode;
    riskLevel: PermissionRiskLevel;
    allowedDataClassifications: PermissionDataClassification[];
    supportsRowFilter: boolean;
    supportsFieldRedaction: boolean;
    obligations?: string[];
  }>;
};
```

催收 / NPA-like Pack 第一批资源应只用通用名：

- `collection_case`
- `case_event`
- `collector_seat`
- `supervisor_queue`
- `quality_issue`
- `payment_promise`
- `legal_handoff`
- `writeback_intent`
- `report_subscription`
- `signal_notification`

第一批 action：

- `list`
- `read`
- `export`
- `comment`
- `assign`
- `review`
- `approve`
- `create_draft`
- `advance_status`
- `prepare_writeback`
- `execute_writeback`

`execute_writeback` 在 public Core 中必须解析为 `blocked_side_effect`；私有 Overlay / control-plane
也必须先满足 actor permission、entitlement、approval receipt 和 dry-run / emergency-stop gate。

本仓 public-safe sample manifest 位于
`extensions/case-management-sample/permission.manifest.json`。它只声明 synthetic case-management
资源，不包含真实租户队列、人员、账户、字段策略或部署信息。

## 8. Overlay Binding 要求

Overlay 负责私有策略绑定，不进入 public Core。

Overlay policy 必须至少表达：

- 租户组织角色 / 用户组 / 人员到 Pack role 或 action 的绑定。
- 队列、区域、主管辖区、客户系统账户、报表订阅等 private scope。
- 字段 mask / redact 规则。
- writeback entitlement、approval receipt、dry-run flag、emergency stop。
- 高风险路径 exact-set writer / operation / target status。

Overlay validator 必须拒绝：

- 额外 writer。
- 额外 operation。
- 额外 target status。
- 未声明的 side effect。
- 默认开启 writeback / external send / financial action / customer contact。
- 把 routing mapping 当 authorization。

## 9. 执行点

以下入口必须接入统一 permission evaluator：

| Surface | Requirement |
| --- | --- |
| API route handler | 先 session / workspace，再 permission decision |
| Extension API dispatcher | dispatcher 或 route metadata wrapper 必须能强制 evaluator；不能只依赖 handler 自觉 |
| Server action | action schema validation 后做 permission decision |
| Read-model query | 支持 row filter，不得只靠 UI hidden |
| Response serialization | 执行 field redaction |
| Extension nav / page access | `getAccess` 必须 subject-aware |
| Report / BI delivery | notification target 不自动获得 viewer 权限 |
| Background job | 明确 service actor 或 delegated actor；`notification_send`、tenant write、financial action 默认 deny |
| Writeback gate | actor permission、review obligation、entitlement、receipt 都必须满足 |
| Export / support pack | 必须检查 data classification 与 field redaction |

## 10. 审计

敏感权限决策必须记录：

- actor type、workspace、user / membership 或 service key。
- resource kind、resource id 或 aggregate scope、extension / pack。
- action name、effect mode、risk level。
- trace id、policy version、source、decision、reason。
- obligations、redactions、failure code。

审计记录不得包含真实敏感字段值、凭据、token、私有域名或客户系统 payload。

Phase 1 的审计先实现 typed decision / audit object 和测试，不新增 Prisma audit table。持久化 audit
table 属于 Phase 2，除非 Phase 1 后半段明确引入数据库行为并补跑 `npm run db:reset`。

Extension API route 注册必须声明 `authorization` metadata：

- `permission_evaluator`：使用 Core evaluator wrapper 先做 permission decision；deny 时不得进入 handler。
- `handler_owned`：只用于迁移保留路径，必须给出 handler 自有 gate 的 public-safe evidence。

缺失 metadata 必须在注册时 fail closed。

## 11. 第一阶段验收标准

Phase 1 只建立 public-safe foundation，不接入真实租户策略。

必须完成：

1. Core permission policy 类型、closed enums、fail-closed evaluator 和 unit tests。
   - `failureCode` 闭集。
   - `PermissionEffectMode` 直接复用 `runtimePermissionProfileSchema`。
   - data classification 到 agentic redaction 状态有确定映射。
2. Synthetic Pack permission manifest fixture 和 validator。
3. Extension access contract 升级为 subject-aware，并保留兼容 shim；extension API route 必须有 wrapper
   或 metadata gate。
4. 一个只读 synthetic sample extension API proof：session -> ownership -> permission -> row filter ->
   field redaction -> deny audit。
5. 一个 review-required sample extension `prepare_writeback` proof：prepare-only -> obligation ->
   execution deny -> no external send / no writeback。
6. Service / background actor proof 至少覆盖 missing service scope deny；任何真实 background effect 接入前
   必须完成 delegated service scope 测试。
7. Public release guard 继续证明没有客户 slug、凭据、私有路径或部署回执。

不得完成或声明：

- 生产租户权限 ready。
- 真实 collection tenant policy ready。
- 客户系统写回 ready。
- 完整 enterprise IAM ready。

## 12. 验证

最小验证链：

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
npm run self-check
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

权限代码落地后追加：

```bash
npm run test -- lib/auth/permission-policy.test.ts
npm run test -- lib/extensions/permission-manifest.test.ts
npm run test -- lib/extensions/permission-access.test.ts
npm run test -- lib/extensions/permission-api-proof.test.ts
```

如果涉及 Prisma schema 或数据库行为，再追加 `npm run db:reset`。文档或纯 TypeScript contract
变更不应为了验证而清空本地数据库。

## English Reference

This contract finalizes Helm's permission-management requirements for
implementation. The current Core workspace membership, role capability matrix,
and `workspaceId` ownership guards remain the foundation, but they are not enough
for industry Packs and tenant Overlays.

Core must define a public-safe, fail-closed permission contract for subjects,
resources, actions, decisions, data classifications, policy sources, and audit
shape. Packs declare generic industry resources, actions, risks, effect modes,
and classifications. Private Overlays bind tenant roles, people, groups, scopes,
field masks, entitlements, receipts, and exact-set high-risk policies.

Unknown or missing policy always denies. Extension enablement is not
authorization. Routing is not authorization. Review-required permission is not
execution permission. Public Core must not contain tenant-specific policy data or
grant automatic writeback, external send, approval execution, financial action,
or customer commitment.

## 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-06-08 | 定稿 public-safe permission policy contract，明确 Core / Pack / Overlay 分工、fail-closed 规则、执行点、审计和 Phase 1 验收标准。 |
| 2026-06-08 | 补充 Phase 1 implementation closure：action-scoped service scope、sample permission manifest、extension API authorization metadata、read/redaction proof 和 review-required writeback proof。 |
