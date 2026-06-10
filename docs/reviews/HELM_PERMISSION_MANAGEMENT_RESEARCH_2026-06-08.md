---
status: active
owner: helm-core
created: 2026-06-08
review_after: 2026-07-08
public_safety: Public-safe permission-management research. Private tenant evidence is redacted; no customer names, personal contact data, private domains, credentials, deployment receipts, or private implementation paths are included.
---
# Helm 权限管理研究 / Helm Permission Management Research (2026-06-08)

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 结论

当前 Helm 已经具备一层可用的 `workspace` 级粗粒度授权：用户必须通过当前工作区会话进入，
多数敏感 server action / API route 会检查 `Membership.role` 对应的 capability，并且查询时普遍
用 `workspaceId` 做 ownership guard。这可以防止跨工作区误读误写，也能覆盖设置、成员、导入、
记忆、审批、运行时复核等平台级操作。

但它还不能满足“组织内不同人员 / 角色看到和操作不同信息，并且行业 Pack 与租户 Overlay
可以声明自己的功能、数据和操作权限”的完整需求。尤其在催收 / NPA-like 行业场景里，案件、
坐席、主管、质检、法务、财务、外呼、回款、写回意图等对象天然需要行级、字段级、动作级、
租户策略级权限；当前 Core / Pack / Overlay 之间还没有统一的权限契约和强制执行面。

建议下一步不要直接扩成完整企业 IAM，也不要把客户专属策略写入公开 Core。正确路径是新增一套
public-safe 的 Core 权限契约：Core 定义通用 subject / action / resource / context / decision；
Pack 声明行业资源、动作、风险、数据分类和默认效果模式；Overlay 在私有仓把租户组织角色、
用户组、人员、私有资源与 Pack 权限绑定；所有读写入口 fail-closed，并记录可审计的 policy
version 与 decision reason。

## 本轮目标与不做

本轮目标：

- 盘点 `helm-public` 当前身份、成员、角色、capability、租户隔离、扩展与写回边界实现。
- 只读检查行业 Pack 与私有租户 Overlay 的权限相关模式，抽象成公开安全结论。
- 判断这些机制是否足以覆盖组织人员 / 角色 / 行业功能 / 租户信息权限。
- 给出最小可验证的后续架构方案。

本轮不做：

- 不新增 runtime 权限系统。
- 不新增完整多组织 / 多权限 / 多租户平台。
- 不把任何客户专属 slug、私有域名、部署回执、真实人员信息或私有实现路径写入本仓。
- 不让 Core import Pack 或 Overlay。
- 不授予自动外发、自动审批、自动客户系统写回或高风险状态变更权限。

## 证据范围

公开 Core 证据来自本仓当前代码和文档，包括：

- `prisma/schema.prisma`
- `lib/auth/authorization.ts`
- `lib/auth/session.ts`
- `lib/auth/tenant-ownership.ts`
- `lib/auth/*-governance.ts`
- `lib/memory/permissions.ts`
- `lib/extensions/*`
- `lib/tenant-overlays/*`
- `lib/solution-extension-manifests.ts`
- `features/settings/*`
- `features/approvals/actions.ts`
- `features/search/ask-helm-access-scope.ts`
- `docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`
- `docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md`

Pack / Overlay 证据只做 sibling repo read-only inspection，并在本报告中脱敏为：

- 催收 / NPA-like industry Pack
- 私有 collection tenant overlay
- 私有写回 gate、handoff execution log policy、supervisor mapping、resource readiness pattern

## 当前实现

### 1. 身份与工作区边界

Core 的身份入口是当前用户 session + 当前工作区 membership。`getCurrentWorkspaceSessionOrNull()`
会解析 auth session、选择 active membership、校正 active workspace，并返回 `user`、
`membership`、`workspace` 和 access state。`setActiveWorkspace()` 也要求当前用户已经是目标
workspace 成员。

这层边界可以回答：

- 当前用户是否有有效登录会话。
- 当前用户是否属于当前 workspace。
- 当前操作应该落在哪个 workspace。

它不能回答：

- 当前用户是否可以看某类行业对象。
- 当前用户是否可以看某个案件 / 坐席 / 主管辖区 / 财务字段。
- 当前用户是否可以执行某个 Pack 或 Overlay 的自定义动作。

### 2. Workspace role capability matrix

`WorkspaceRole` 当前包括：

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`
- `OPERATOR`
- `REVIEWER`
- `MEMBER`

`lib/auth/authorization.ts` 把这些 role 映射到 workspace capability，例如成员管理、计费管理、
导入管理、连接器管理、记忆导出、内部 action 管理、governed action 管理 / 复核、runtime 管理 /
复核、admin audit 读取等。

这层能覆盖平台级控制面操作，例如：

- 谁能管理成员和设置。
- 谁能管理导入、连接器、workspace records。
- 谁能管理或复核 governed actions。
- 谁能读 admin audit 或导出 support pack。

它仍然是粗粒度授权。`Membership.role` 没有携带行业对象、字段、数据分类、辖区、队列、案件集、
租户策略版本或 Pack action 权限。

### 3. Ownership guards

`lib/auth/tenant-ownership.ts` 通过 `workspaceId` 校验记录归属，常见模式是用 `id + workspaceId`
查询业务记录。这是当前最重要的防越界机制。

它能防止：

- 用户用另一个 workspace 的 id 读取或改写记录。
- API route 忘记把当前 workspace 带入查询。

它不能防止：

- 同一 workspace 内 A 角色看到 B 角色不该看的行。
- 同一 workspace 内敏感字段被无权限角色读取。
- Pack / Overlay 自定义资源缺少统一 ownership 和 permission check。

### 4. Settings 与成员资料的有限 masking

Settings 查询里存在少量基于 role 的 profile 字段 masking。它证明系统已经意识到“同一工作区内
不同角色不应看到完全相同信息”，但这还不是通用字段级权限框架。

当前没有看到一套可复用的 field policy，例如：

- 字段数据分类。
- role / capability 到字段可见性的矩阵。
- query 层自动投影。
- API response 层统一 redact。
- audit 记录哪些字段被拒绝或脱敏。

### 5. Approval 与高风险动作边界

Approval 相关 server action 使用 workspace session，并区分 manage / review governed actions。
高风险 task 还有 `approverId`、`reviewedById`、`isHighRisk`、`autoExecute` 等字段。当前公开样板和
manifest 也持续强调 review-first、non-commitment、no auto external send / writeback。

这层很适合防止“建议被误解成承诺”或“AI 自动执行高风险动作”。但它不是完整权限系统：

- 它主要管 action review / approval，不管普通读取。
- 它不定义行业对象的 owner / viewer / operator / supervisor / auditor 关系。
- 它不覆盖所有 Pack / Overlay API route。

### 6. Solution Extension 与 tenant overlay

公开 Core 的 Solution Extension 协议明确保持：

```text
Core SDK <- Pack SDK <- Overlay
```

Core 可以提供 SDK seam，Pack / Overlay 可以依赖 Core，但 Core 不能反向依赖 Pack 或 Overlay。
`WorkspaceSolutionExtension` 当前表示 workspace 启用某个 extension，并保存 `configJson`。
公开 overlay capability 主要围绕主题、文案、默认 locale、extension enablement、connector config
reference 等安全范围。

关键缺口是：extension access 目前主要是 workspace enablement，而不是 user-aware access。
`lib/extensions/registry-contract.ts` 中的 contribution / nav / report access 没有形成统一的
`subject + action + resource + context` 权限判断。某些 extension API route 由 handler 自己负责
auth，dispatcher 本身也明确不提供新权限模型。

这意味着 extension 层现在可以回答：

- 这个 workspace 是否启用了某个 extension。
- 这个 extension 是否声明了 review-first / read-only 等边界。

但它不能统一回答：

- 当前用户是否可以进入某个 extension 页面。
- 当前用户是否可以运行某个 Pack action。
- 当前用户是否可以读某个租户 overlay 私有映射或写回意图。

### 7. Pack / Overlay 观察到的权限模式

只读检查显示，行业 Pack 和私有 Overlay 已经有一些接近权限治理的局部机制：

- 行业 Pack 有 supervisor mapping / notification target，用来把信号路由给负责人。
- 行业 Pack 的运行时验证要求写回默认关闭，租户 key 由 Overlay 注入，不允许 Pack 内硬编码租户。
- 私有 Overlay 有 read-only resource readiness、dry-run writeback gate、entitlement / approval receipt
  前置条件、handoff execution log exact-set policy。
- 私有 Overlay 的 handoff execution log policy 已经收窄到有限 writer、有限 operation、有限 target
  status，并禁止 customer-system writeback、auto-approve、external send、高风险状态覆盖。

这些机制是好的局部 guard，但它们仍不是统一权限体系：

- routing mapping 不是 authorization。
- writeback gate 不是 read permission。
- entitlement / receipt gate 不是用户级角色策略。
- exact-set handoff policy 是单一路径的最小权限，不覆盖所有行业对象和 API。
- Overlay API route 如果只检查 active workspace + extension enabled，仍可能允许同 workspace 内过宽访问。

## 需求适配度：催收行业与私有租户 Overlay

### 能满足的部分

当前 Helm 可以满足以下基础需求：

| 需求 | 当前状态 | 说明 |
| --- | --- | --- |
| 工作区隔离 | 可满足 | session + membership + `workspaceId` ownership guard 是当前最稳边界。 |
| 平台设置权限 | 可满足 | `WorkspaceRole` capability matrix 覆盖 settings、members、billing、imports、runtime、audit 等。 |
| 高风险动作复核 | 部分满足 | governed actions / approval task 有 review-first 边界，但不是所有动作都有统一入口。 |
| Extension 启用控制 | 部分满足 | `WorkspaceSolutionExtension` 可控制 workspace 是否启用 extension。 |
| 写回默认关闭 | 部分满足 | Pack / Overlay pattern 已有 read-only / dry-run / approval receipt gate。 |
| 客户系统副作用隔离 | 部分满足 | 当前 public sample 和 private overlay pattern 都强调 no external send / no writeback by default。 |

### 不能满足的部分

催收 / NPA-like 行业和私有租户通常至少需要：

| 需求 | 当前缺口 |
| --- | --- |
| 组织角色到业务权限映射 | Core 只有 workspace role；Pack / Overlay 没有统一业务 role binding。 |
| 案件 / 队列 / 坐席 / 主管辖区行级权限 | 当前主要按 `workspaceId` 隔离，没有通用 row-level filter contract。 |
| 手机号、证件号、财务字段、沟通记录等字段级可见性 | 没有通用 field classification、projection、redaction 和 audit。 |
| Pack action 权限 | Pack 可以声明能力和边界，但没有标准 action permission manifest。 |
| Overlay 私有信息权限 | Overlay 可以注入配置和 gate，但缺少统一 subject-aware policy evaluator。 |
| 报表 / BI / notification audience 控制 | 现有 supervisor mapping 更偏 routing，不等于 viewer / operator 权限。 |
| 后台 job 代表谁执行 | 需要明确 service actor、human actor、delegated actor 的权限继承和审计。 |
| 跨 Core / Pack / Overlay 的拒绝默认 | 多数公共 Core 入口是 fail-closed，但 extension 自定义入口仍取决于 handler 是否自行实现。 |

因此，如果用“催收行业 + 私有租户组织”的真实需求做标准，当前实现应判定为：

- `已成形但仍需下一层`，不是 `已经完整成立`。
- 可继续作为权限体系的底座，但不能直接承诺满足租户级精细权限。

## 推荐方案

### 1. Core 定义通用权限契约

新增 public-safe Core contract，避免客户专属策略进入公开仓：

```ts
type PermissionEffect = "allow" | "deny";

type PermissionSubject = {
  workspaceId: string;
  userId?: string;
  membershipId?: string;
  workspaceRole: WorkspaceRole;
  rolePresetKey?: string | null;
  actorType: "user" | "service" | "system";
};

type PermissionResource = {
  kind: string;
  workspaceId: string;
  extensionKey?: string;
  packKey?: string;
  resourceId?: string;
  dataClassifications?: string[];
};

type PermissionAction = {
  name: string;
  effectMode: "read_only" | "draft_only" | "review_required" | "side_effect";
  riskLevel: "low" | "medium" | "high" | "critical";
};

type PermissionDecision = {
  effect: PermissionEffect;
  reason: string;
  policyVersion: string;
  obligations?: string[];
  redactions?: string[];
};
```

Core 只定义契约、默认拒绝、audit shape 和基础 workspace role fallback，不内置租户业务策略。

### 2. Pack 声明行业资源与动作

催收 / NPA-like Pack 应声明：

- 资源：case、case event、collector seat、supervisor queue、quality issue、payment promise、legal handoff、
  writeback intent、report subscription、signal notification。
- 动作：read、list、export、comment、assign、review、approve、create draft、advance status、prepare
  writeback、execute writeback。
- 数据分类：public sample、workspace internal、regulated personal data、financial data、contact data、
  legal-sensitive data、tenant-private config。
- 默认效果模式：多数读为 `read_only`，外发 / 写回 / 状态推进至少 `review_required`。

Pack 不能声明租户真实用户、真实域名、真实系统凭据或客户组织结构。

### 3. Overlay 绑定私有组织角色与策略

私有 Overlay 负责把租户实际组织映射到 Pack permissions：

- 人员 / 组 / 组织角色到 Pack role 的映射。
- 队列、区域、主管辖区、客户系统账户等私有 resource scope。
- 字段脱敏策略。
- writeback entitlement、approval receipt、dry-run flag、emergency stop。
- 高风险路径 exact-set policy。

Overlay policy 必须由私有验证脚本校验：

- 不允许额外 writer。
- 不允许额外 operation。
- 不允许额外 target status。
- 默认 writeback / external send / financial action 为 false。
- 未声明权限默认 deny。

### 4. 执行点必须统一接入权限检查

最小执行面：

- API route handler。
- Server action。
- read-model query。
- report / BI delivery。
- extension nav / page access。
- background job。
- writeback gate。
- export / support pack。

其中 read-model query 需要支持 row filter；response 层需要支持 field redaction；side-effect path
必须支持 approval obligation。

### 5. 审计与观测

每次敏感决策至少记录：

- subject：actor type、user / membership、workspace role。
- action：name、effect mode、risk level。
- resource：kind、workspace、extension / pack、resource id 或 scope。
- decision：allow / deny、reason、policy version。
- source：Core default、Pack manifest、Overlay binding、control-plane entitlement。
- obligations：需要复核、需要 approval receipt、需要 dry-run、需要 redact。

deny 也要记录，否则无法排查“看不到”和“不能操作”的原因。

## 受影响组件

| 组件 | 影响 |
| --- | --- |
| `prisma/schema.prisma` | 可能新增 permission policy / audit / binding metadata，但应避免一开始就做大迁移。 |
| `lib/auth/authorization.ts` | 保留 workspace role capability matrix，作为 Core base capability。 |
| `lib/auth/tenant-ownership.ts` | 继续负责 workspace ownership；上层增加 row / field / action policy。 |
| `lib/extensions/registry-contract.ts` | `getAccess` 需要变成 subject-aware，而不只是 workspace-aware。 |
| `WorkspaceSolutionExtension` | 需要从 workspace enablement 扩展到可引用 permission manifest / policy binding。 |
| Pack manifest | 需要声明行业资源、动作、风险、数据分类、默认效果模式。 |
| Overlay manifest | 需要声明私有组织绑定、资源 scope、字段 mask、writeback / approval gate。 |
| API routes / server actions | 必须统一调用 permission evaluator，不能只靠 handler 自觉。 |
| BI / reporting / notifications | routing 与 authorization 分离；通知目标不自动获得读取全部数据权限。 |
| Background jobs | 需要明确 service actor / delegated actor，并记录权限来源。 |

## 权衡

- 继续只用 workspace role：实现快，但很快会在行业对象、字段脱敏、私有租户策略上失控。
- 直接引入完整企业 IAM：能力强，但会把当前 public Core 推向过度平台化，也容易与 Helm 当前
  controlled-trial / delivery-engineer-facing 边界冲突。
- 推荐的 manifest + evaluator 路径：能保持 Core public-safe，又给 Pack / Overlay 留出行业和租户
  扩展点；代价是需要补一组强制执行点、fixture、validator 和 audit。

## 验证方案

后续实现权限体系时，至少需要这些验证：

1. Core unit tests：`workspaceRoleHasCapability()` 仍保持现有语义；permission evaluator 对未知
   action / resource fail-closed。
2. API route tests：无 membership、错误 workspace、缺少 capability、缺少 Pack permission、缺少
   Overlay binding 均返回 deny。
3. Query tests：同 workspace 内不同角色只能看到授权行。
4. Field masking tests：敏感字段默认 redact，授权角色才可见。
5. Pack manifest validator：行业资源 / action / effect mode / data classification 必须完整声明。
6. Overlay policy validator：exact-set writer / operation / target status；禁止额外高风险权限。
7. Public release guard：公开仓不得出现客户 slug、私有域名、真实人员信息、凭据或部署回执。
8. Audit tests：allow / deny 都有 policy version 和 reason。

## 剩余风险

- 当前 extension 自定义 route 的权限强度不一致；需要逐个收敛到统一 evaluator。
- `rolePresetKey` 和业务 persona 容易被误用成授权角色；它们当前只能作为路由 / onboarding 线索。
- Supervisor mapping / notification routing 容易被误解成权限；必须在模型和文档中分开。
- 写回 gate 如果只验证 entitlement / receipt，而不验证 actor permission，仍可能在同 workspace 内过宽。
- 字段级权限一旦只在 UI 做 masking，API / export / background job 仍可能泄漏。

## 下一步建议

实施依据已收成：

- [权限策略契约](../product/HELM_PERMISSION_POLICY_CONTRACT.md)
- [权限策略实施计划](../product/HELM_PERMISSION_POLICY_IMPLEMENTATION_PLAN.md)

后续以这两份文件为权威任务来源，本研究报告只作为背景证据。第一阶段实施顺序：

1. 在 Core 新增最小 `lib/auth/permission-policy.ts`，实现 fail-closed evaluator、typed decision、
   active membership、service scope 和 audit shape。
   - `failureCode` 必须是闭集 enum；negative tests 断言 failure code，不断言自由文本。
   - `PermissionEffectMode` 必须复用 `runtimePermissionProfileSchema`。
   - data classification 必须映射到现有 agentic redaction 状态。
2. 给 sample extension 增加 synthetic Pack permission manifest，覆盖 read/list/review/prepare action。
3. 把 extension registry / API route access 升级为 subject-aware，并保持旧 contract 的兼容 shim。
4. 选择 synthetic sample extension API 做 read-only proof：session -> workspace ownership -> permission ->
   row filter -> field redaction -> deny audit。
5. 选择 synthetic sample extension `prepare_writeback` fixture 做 review-required proof：prepare-only ->
   obligation -> execution deny -> no external send / no writeback。
6. 在任何真实 background effect 接入前，补 service / system actor scope proof。

## English Reference

Helm currently has a usable workspace-level authorization base: active workspace
membership, coarse `WorkspaceRole` capability checks, and `workspaceId`
ownership guards. This is enough for workspace isolation and platform-level
settings/imports/memory/runtime/approval controls.

It is not enough for a full organization, industry Pack, and tenant Overlay
permission system. Collection / NPA-like use cases need row-level, field-level,
action-level, and tenant-policy-level authorization across cases, queues,
supervisors, quality, finance, legal handoffs, notifications, and writeback
intents.

The recommended path is a public-safe Core permission contract plus Pack
resource/action declarations and private Overlay bindings. Core should define a
fail-closed evaluator, audit decision shape, and base capability fallback. Packs
declare industry resources, actions, risk, data classification, and effect
modes. Overlays bind private tenant roles, people, groups, scopes, field masks,
entitlements, receipts, and exact-set high-risk policies. Core must not import
Pack or Overlay, and public docs must not carry tenant-specific policy data.
