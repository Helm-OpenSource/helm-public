---
status: active
owner: helm-core
created: 2026-06-08
review_after: 2026-07-08
public_safety: Public-safe permission architecture research. Private tenant names, private hosts, customer routes, credentials, and deployment receipts are intentionally omitted.
---

# Helm 权限管理研究

## 结论

当前 Helm 已经有一套可工作的基础权限骨架：

- 登录 session 会绑定到 active workspace。
- 数据模型用 `Membership.role` 表达用户在 workspace 内的粗粒度角色。
- `WORKSPACE_CAPABILITIES` 把 workspace role 映射到成员管理、设置、导入、记忆、动作复核、runtime 等能力。
- 多数写 API 先取 current workspace session，再做 role capability 和 workspace ownership 校验。
- Pack / Overlay extension seam 能按 workspace + extension enablement 做启用检查。
- LLM-facing runtime permission 采用 fail-closed allow-list，默认阻断外部副作用。

这套机制能满足 Public Core P0 的基本要求：防止跨 workspace 访问，约束关键设置和写操作，并保持 review-first / no silent writeback 边界。

但它还不能完整满足“组织内不同人员/角色看到和操作不同内容，并且 Pack / Overlay 有行业与租户专属功能和信息”的需求。主要缺口是：现在的权限是 workspace-wide RBAC，缺少面向行业资源、租户资源、字段、行、动作、审批、外部系统写回的统一授权契约。催收行业与私有催收租户这类场景需要 Pack 声明 domain permission，Overlay 绑定 tenant org role / user / group，再由 Core 提供一致的 enforcement 和 audit seam。

## 研究范围

本轮只做研究和架构判断，不改运行时权限代码。

已核对的 public Core 证据：

- `prisma/schema.prisma`
- `lib/auth/authorization.ts`
- `lib/auth/session.ts`
- `lib/auth/tenant-ownership.ts`
- `lib/auth/*-governance.ts`
- `lib/memory/permissions.ts`
- `features/settings/queries.ts`
- `features/settings/solution-extension-actions.ts`
- `features/approvals/actions.ts`
- `features/search/ask-helm-access-scope.ts`
- `lib/extensions/api-route-registry.ts`
- `lib/extensions/registry-contract.ts`
- `lib/extensions/registry-types.ts`
- `app/api/extensions/[...slug]/route.ts`
- `lib/solution-extensions.ts`
- `lib/tenant-overlays/contract.ts`
- `lib/tenant-resources/readiness.ts`
- `extensions/case-management-sample/`

也做了只读 sibling repo spot-check。私有 Pack / Overlay 证据不在本公开报告中展开具体租户名、私有路径、客户系统名、人员名或部署细节，只抽象为 redacted patterns。

## 当前实现

### 1. 身份与工作区边界

`User`、`AuthSession`、`Workspace`、`Membership` 是当前身份主链路。

`AuthSession` 记录 `userId` 与 `activeWorkspaceId`。`getCurrentWorkspaceSession()` 会根据 session 和 active workspace 找到当前用户在该 workspace 的 membership，并返回：

- `user`
- `membership`
- `workspace`
- `accessState`

`Membership` 有：

- `workspaceId`
- `userId`
- `role`
- `status`
- `rolePresetKey`
- 成员职责 / goal profile 字段

这里的 `role` 是唯一真正用于授权的主字段。`rolePresetKey` 更像业务角色语义和路由辅助，不是授权角色。

### 2. Workspace role 与 capability matrix

当前 role 固定为：

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`
- `OPERATOR`
- `REVIEWER`
- `MEMBER`

`lib/auth/authorization.ts` 定义了 `WORKSPACE_CAPABILITIES`，包括：

- `workspace.manage_members`
- `workspace.manage_billing`
- `workspace.manage_policies`
- `workspace.manage_workspace_setup`
- `workspace.manage_operational_controls`
- `workspace.export_memory`
- `workspace.manage_memory_facts`
- `workspace.manage_connectors`
- `workspace.manage_imports`
- `workspace.resolve_import_conflicts`
- `workspace.manage_workspace_records`
- `workspace.manage_governed_actions`
- `workspace.review_governed_actions`
- `workspace.manage_runtime`
- `workspace.review_runtime`
- `workspace.read_admin_audit`

这个矩阵已经能表达不少“谁可以改设置 / 管成员 / 跑导入 / 处理记忆 / 复核动作”的需求。

但它是全 workspace 级别，不能直接表达：

- 某个行业 Pack 的某类报表只能主管看。
- 某个坐席只能看自己名下案件。
- 质检能看录音与 QC issue，但不能看财务还款详情。
- 法务/合规能看投诉、停催、合规阻断，但不能执行分案写回。
- 租户实施工程师能配置映射，但不能看敏感客户明细。
- 某个 overlay 的外部写回必须由指定 founder / owner approval receipt 才能执行。

### 3. Route 与 service enforcement

当前写路径常见模式是：

1. `getCurrentWorkspaceSession()`
2. 检查 `canManage*` 或 `canReview*`
3. 对目标对象执行 `assertWorkspace*Ownership`
4. 写 DB
5. 写 audit log / revalidate

例如：

- memory facts / commitments / blockers 使用 `canManageWorkspaceMemory`。
- imports / connectors 使用 `canManageWorkspaceImports`、`canManageWorkspaceConnectors`。
- approvals 使用 `canReviewWorkspaceGovernedActions`。
- settings 使用 `canManageWorkspaceMembers`、`canManageWorkspacePolicies`、`canManageWorkspaceSetup`。
- solution extension toggle 使用 `canManageWorkspaceSetup`。

`tenant-ownership.ts` 能防止用户拿 active workspace 去操作另一个 workspace 的对象。这是跨租户隔离的关键底座。

缺口是：这些 guard 多数只判断 workspace role，不判断 domain resource、record owner、team chain、field sensitivity、extension-specific policy 或 action-specific approval policy。

### 4. Read model 可见性

现在已经有少量 read-side masking。例如 settings 查询里，非 member-manager 会把成员 goal profile / job responsibility 字段置空。

这说明代码已经接受“读模型也要按权限裁剪”的方向。

但这仍是局部实现，不是统一能力：

- 搜索 `searchWorkspaceEntities()` 只按 `workspaceId` 过滤，不按角色/字段/对象 owner 裁剪。
- Ask Helm access scope 只有 current workspace / no official write 这类粗粒度规则。
- operating / reports / BI / tenant resource readout 主要靠 workspace 和 extension access，缺少 per-role read policy。
- extension-contributed surfaces 的 `getAccess(workspace)` 只收 workspace，不收 subject / membership / action / resource context。

### 5. Pack / Overlay seam

Core 的 extension registry 已经完成了很重要的 repo-split 边界：

- Core 不 import private tenant code。
- Pack / Overlay 通过 composition root 注册 surfaces / reports / nav / API handlers。
- API catch-all dispatcher 只负责 method + path 分发。

但 `lib/extensions/api-route-registry.ts` 和 `app/api/extensions/[...slug]/route.ts` 明确说明：dispatcher 不做 auth，每个 Pack / Overlay handler 保留自己的 gate。

这对 repo split 是正确的，但对权限体系意味着：Core 现在没有给 Pack / Overlay 提供统一的权限 contract。每个 Pack / Overlay 只能自己写 access probe、membership lookup、env guard、entitlement gate 或 exact-set script。

### 6. Tenant resource readiness

`lib/tenant-resources/readiness.ts` 可以把 connector / import source / extension / capture session 转成 resource readiness，并表达：

- `readCapability`
- `writeCapability`
- `allowedEffectModes`
- `reviewRequirement`
- `writeBackAllowed`
- `fallbackMode`

这对“资源是否可用、是否 review-first、是否允许 writeback”很有价值。

但它当前是 readout / readiness，不是授权 enforcement。`policy-readout.ts` 也明确说 tenant policy readout is read-only and does not enforce policy by itself。

### 7. 行业 Pack 观察

私有行业 Pack 的只读 spot-check 显示，催收/NPA-like Pack 已经开始表达这些行业语义：

- seat-level / row-level signal routing
- supervisor mapping
- active membership resolution
- notification target readiness
- default owner role
- no writeback / dry-run default
- Pack-local Core host seam，避免直接 import Core session / membership internals

这说明行业 Pack 已经有业务角色和运营路由需求，但它们目前更像“路由与上线 readiness”，不是统一授权模型。典型缺口是：主管 mapping 能把信号路由给主管，但还不能系统性声明“主管能看哪些队列、字段、报表、动作，坐席能看哪些自己的记录，质检/合规/财务各自能看或操作什么”。

### 8. 私有租户 Overlay 观察

私有催收租户 overlay 已经有更严格的特定路径治理：

- writeback 默认 dry-run/off。
- 外部写回需要 local explicit flag、control-plane entitlement、approval receipt。
- handoff execution log policy 使用 exact-set：
  - allowed writers 只允许 approver / actionOwner。
  - allowed operations 只允许 audit log write / advance signal status。
  - allowed target statuses 只允许 actioned / resolved。
  - 明确禁止 customer system writeback、auto approve、external send、high-risk state override。

这对“某条高风险路径最小权限”是好的。

但它仍不是完整权限体系：

- extension access 主要看 tenant enabled、workspace slug/systemKey、WorkspaceSolutionExtension enabled、env guard。
- 某些 tenant API 只要有 current workspace session + extension access 就能读/写映射。
- 写回 gate 保护的是外部系统写回，不等于保护所有内部读、映射维护、报表查看、人工接收、导出或训练样本使用。

## 能否满足需求

### 已能满足

| 需求 | 当前状态 |
|---|---|
| 登录用户必须属于 active workspace 才能进入工作区 | 已成立 |
| 跨 workspace 对象读写隔离 | 已成立，依赖 workspaceId ownership |
| 管成员、改设置、改策略、导入、连接器、记忆写入、动作复核的粗粒度 RBAC | 已成立或基本成立 |
| Extension 是否在 workspace 启用 | 已成立 |
| LLM 不能获得外部副作用 handle | 已成立为 fail-closed guard |
| 高风险动作保留 review-first / approval-first 边界 | 已成形 |
| 部分 read model 字段 masking | 已有局部实现 |
| 私有 overlay 对某个写回路径做 exact-set / entitlement / receipt gate | 已有局部实现 |

### 不能满足或只能部分满足

| 需求 | 当前缺口 |
|---|---|
| 同一组织内不同人员看到不同业务对象 | 缺少 row-level policy，当前多为 workspaceId 过滤 |
| 不同人员看到同一对象的不同字段 | 只有少量局部 masking，没有统一 field policy |
| 行业 Pack 声明自己的 domain roles / resources / actions | 没有 public Pack permission manifest contract |
| Overlay 把租户组织架构绑定到 Pack 权限 | 没有 tenant permission binding contract |
| Extension surface/API 统一按 subject + resource + action 授权 | registry/getAccess 只看 workspace，API dispatcher 不做 auth |
| 报表、信号、通知、owner routing 与授权统一 | 目前更多是 routing/readiness，不是 permission decision |
| 外部写回之外的敏感操作权限 | 某些路径有 guard，但没有全域策略 |
| deny/allow 的标准审计证据 | Audit log 存在，但权限 decision 没有统一 receipt schema |
| 系统 actor / cron / scheduler 的权限边界 | 有 token/env/guard，但缺少与人类授权、tenant policy 的统一模型 |

## 催收行业示例需求

一个催收/NPA-like Pack 至少需要把这些角色语义明确成权限，而不只是路由：

- 组织 owner / admin：管理成员、启用 Pack、配置策略、查看审计和支持包。
- 催收运营主管：查看组内队列、主管日报、坐席绩效、异常信号；确认承接和分派；不能直接越过 writeback gate。
- 坐席 / case owner：查看自己名下案件、自己的跟进建议、自己的待办；不能看全量人员绩效和其他组敏感明细。
- 质检 / reviewer：查看录音、催记、QC issue、投诉/合规阻断；可以标注复核结果；不能执行外部写回。
- 法务/合规：查看停催、投诉、合规风险、高风险样本；可以要求阻断或升级；不能做业务分案。
- 财务：查看还款、回款、财务口径报表；不应看全量通话或案件敏感字段。
- 实施工程师：配置字段映射、资源 manifest、dry-run；默认不能查看真实人员/客户明细，除非 overlay 明确授权。
- 只读审计员：查看 policy decision、audit receipt、release/readiness 证据；不能改配置。

这要求权限模型能同时表达：

- resource type：case、seat profile、call record、QC issue、repayment、report、mapping、writeback intent、training sample
- action：read、read_sensitive、configure_mapping、route_signal、review、advance_status、export、send_notification、writeback、approve_writeback
- scope：self、team、manager_chain、workspace、extension、tenant
- data class：public_sample、redacted、alias_only、internal_sensitive、regulated_sensitive
- effect mode：read_only、draft_only、manual_execution、guarded_write_intent、external_write

## 私有租户 Overlay 示例需求

私有租户 overlay 需要做的不是在 public Core 写死租户名，而是声明 tenant-local bindings：

- 哪些 tenant org role / department / group 对应 Helm membership、rolePreset、persona 或外部 directory group。
- 哪些 Pack resource 对哪些 role 可见。
- 哪些 action 需要 approver、actionOwner、founder approval receipt、control-plane entitlement。
- 哪些 writeback 永远默认 off，必须由 explicit flag + entitlement + approval receipt + audit receipt 才能开启。
- 哪些字段必须 redacted / alias-only / role-gated。
- 哪些 AI/LLM 路径只能产生 review packet，不能进入 writeback、external send、training promotion。

当前 overlay 已有一个具体写回 gate 和 handoff log exact-set policy，可以作为新权限体系的 pattern，但不能直接代表全域完成。

## 建议方案

### Phase 0：先定义 public-safe permission contract

在 Core 增加一个不含客户信息的 contract 层，先不接 DB migration：

```ts
type PermissionSubject = {
  userId: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  rolePresetKey?: string | null;
  persona?: string | null;
  externalGroupRefs?: string[];
};

type PermissionResource = {
  resourceType: string;
  resourceId?: string;
  workspaceId: string;
  extensionKey?: string;
  packKey?: string;
  ownerUserId?: string | null;
  managerUserIds?: string[];
  dataClass?: string;
};

type PermissionAction =
  | "read"
  | "read_sensitive"
  | "configure"
  | "review"
  | "advance_status"
  | "export"
  | "send_notification"
  | "writeback"
  | "approve_writeback";

type PermissionDecision = {
  allow: boolean;
  reasonCode: string;
  policyVersion: string;
  requiredReview?: string;
  auditRequired: boolean;
};
```

这一步只落类型、fixtures、tests 和 docs，不引入真实客户策略。

### Phase 1：Pack 声明 domain permission manifest

Pack 不应该 import Core auth internals，也不应该写死 tenant org。Pack 应声明：

- domain resources
- domain actions
- required scopes
- default data classes
- maximum effect mode
- recommended role bindings
- forbidden actions
- review requirements

例如催收 Pack 声明：

- `collection.case.read:self`
- `collection.case.read:team`
- `collection.call_record.read_sensitive:qc`
- `collection.report.read:supervisor`
- `collection.mapping.configure:implementation`
- `collection.writeback.approve:tenant_owner`

这些只是 Pack contract，不直接授权某个真实客户。

### Phase 2：Overlay 绑定 tenant policy

Overlay 负责把租户真实组织结构绑定到 Pack contract：

- tenant role / group -> Pack permission set
- external directory identity -> Helm user / membership
- supervisor mapping -> manager-chain scope
- approval receipt -> high-risk action allowance
- env/entitlement -> writeback enablement

Overlay policy 必须 exact-set 和 fail-closed。任何未声明 role、未解析 membership、未配置 notification target、未提供 receipt 的路径都应该降级到 read-only / review packet。

### Phase 3：Core enforcement seam

Core 提供统一 helper：

- `assertPermission(subject, action, resource, context)`
- `filterReadableResources(subject, resources)`
- `maskResourceFields(subject, resource)`
- `buildPermissionDecisionReceipt(decision)`

Route / action / report / Ask Helm / Pack API handler 都复用这组 helper。Extension registry 的 `getAccess(workspace)` 应升级或新增 subject-aware 版本，例如：

```ts
getAccess({ workspace, subject, action, resource })
```

保留旧接口做兼容，但新 Pack / Overlay 走 subject-aware access。

### Phase 4：审计与验证

每个 deny/allow，特别是敏感 allow，都应能生成稳定 evidence：

- subject id
- workspace id
- action
- resource reference
- policy key/version/hash
- decision reason
- required receipt ref
- effect mode
- timestamp

验证应包括：

- role matrix tests
- Pack permission manifest validation
- Overlay binding validation
- exact-set policy tests
- route guard tests
- read model masking tests
- public-release guard：禁止客户名、真实邮箱、手机、私有 host、真实 token

## 受影响组件

- `prisma/schema.prisma`
- `lib/auth/authorization.ts`
- `lib/auth/*-governance.ts`
- `lib/auth/tenant-ownership.ts`
- `lib/extensions/*`
- `lib/solution-extensions.ts`
- `lib/tenant-resources/*`
- `features/search/*`
- `features/settings/*`
- `features/approvals/*`
- Pack SDK registry / manifest validator
- Overlay tenant manifest / resource manifest validator
- Audit log / permission receipt schema

## 权衡

- 继续只用 `WorkspaceRole` 最快，但会把行业角色压扁，后续每个 Pack / Overlay 都会复制自己的 guard。
- 直接上完整 ABAC/OPA 风格引擎表达力强，但对当前 public Core 过重，也容易引入新的平台承诺。
- 推荐路径是 contract-first、manifest-first、fail-closed、incremental adoption：先把 Pack / Overlay 权限声明标准化，再逐步把关键 read/write path 接入统一 guard。

## 验证结果

本轮是研究报告，没有改 runtime 代码。

已完成：

- 工作区治理检查：隔离 worktree 干净，主检出有外部 `.claude/` WIP，不在本分支修改。
- Public Core 代码/文档读取。
- Sibling Pack / Overlay origin-main 只读 spot-check。
- 本报告保持 public-safe，不包含私有租户名、真实人员、真实邮箱、私有 host、生产 URL、密钥或部署回执。

建议本报告合并前至少运行：

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

如果后续进入权限 contract 实现，还应追加：

```bash
npm run typecheck
npm run lint
npm run test
```

## 剩余风险

- Sibling repo 证据来自只读 spot-check；它证明 pattern 存在，但不代表所有私有 Pack / Overlay 路径都已覆盖。
- 当前 public Core 的 extension registry 没有 subject-aware access，未来改接口需要兼容旧 Pack。
- 如果直接把 overlay policy 挪进 public Core，容易泄露租户结构和客户信息；必须坚持 Pack 声明通用能力，Overlay 绑定私有策略。
- 系统 actor、cron、scheduler、外部 connector callback 的授权模型需要单独审计，不能只套用户 RBAC。
- 权限体系引入后，read model 和 query filtering 的遗漏风险高，需要用 negative tests 和 deny-by-default fixtures 守住。

## 下一步建议

1. 新建 `docs/product/HELM_PERMISSION_CONTRACT_REQUIREMENTS.md`，先定义 subject / action / resource / decision / receipt 的 public-safe contract。
2. 给 `extensions/case-management-sample` 增加 synthetic permission fixture，证明 self/team/workspace/read_sensitive/mask 的最小路径。
3. 给 Pack SDK 增加 `permissionManifest` schema 和 validator，不接真实客户。
4. 给 Overlay repo 增加 tenant policy binding validator，沿用 exact-set 思路，禁止额外 writer/action/status。
5. 选一个只读 surface 先接入 subject-aware access，例如 report tab / signal readout / Ask Helm retrieval，而不是先做 writeback。
