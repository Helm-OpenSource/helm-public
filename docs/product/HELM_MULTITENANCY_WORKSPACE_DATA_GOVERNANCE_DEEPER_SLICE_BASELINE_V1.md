---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Workspace Data Governance Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第九层治理收紧上的真实边界。

本基线只回答四件事：

1. workspace / opportunity / inbox / contact / company / customer-success handoff 这组剩余 workspace data write path 已统一到哪一层
2. org-admin support-pack 对 workspace data governance 与 internal action follow-through 已成立到哪一层
3. settings governance surface 对 workspace data governance 的 readout 已成立到哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader workflow / execution surface
- execution-authority expansion

## 2. 当前基线

当前多租户 / 多用户控制面继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

当前租户真值仍然是：

- `Workspace == Organization == current tenant boundary`
- `Membership` 仍然是 user-to-workspace seam
- `AuthSession` 仍然是当前登录 session 真值
- tenant isolation 仍然主要靠 application-layer workspace scoping

## 3. 已经完整成立

### 3.1 Shared workspace-data-governance seam 已成立

当前 workspace data write 主链路已经再收回一层：

- `canManageWorkspaceRecords`
- `canManageWorkspaceInternalActions`

以及对应 denial messaging：

- `getWorkspaceRecordManagementDeniedMessage`
- `getWorkspaceInternalActionDeniedMessage`
- `getWorkspaceScopedRecordUnavailableMessage`
- `getWorkspaceAssignableOwnerDeniedMessage`

这条 seam 现在覆盖的高风险 tenant-sensitive 写路径包括：

- quick contact / meeting creation
- opportunity create / update / stage / next-action / owner / bulk update
- inbox thread bind / upgrade / reminder
- contact link / merge / archive
- company quick opportunity
- customer-success internal action approve / execute

同时，contact memory append / add-working-memory 也已经重新接回现有 memory governance capability，而不再绕开 `workspace.manage_memory_facts`。

### 3.2 租户范围引用校验已补齐一层

本轮除了 capability gate，还补了 workspace-scoped record validation：

- `companyId`
- `contactId`
- `opportunityId`
- `threadId`
- `entryId`
- `ownerId`

这意味着这些 action 不再只依赖“当前用户已登录”，而是会显式确认：

- 对象属于当前 workspace
- owner 是当前 workspace 的有效成员

这层收紧的目标是减少 cross-tenant object id 被带入当前 workspace 写链路的风险。

### 3.3 Org-admin support-pack 已能解释 workspace data governance follow-through

当前 `getOrgAdminGovernanceSummary` 已把以下 workspace data governance readout 补齐：

- `workspaceDataActionCount30d`
- `internalActionCount30d`
- `latestWorkspaceDataAudit`
- `latestInternalActionAudit`

同时：

- `MEMORY_ADDED` 已纳入 memory governance truth
- `CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED` 已成为明确的治理审计动作

这样 support-pack 不再只偏向 settings / memory / import / commercial governance，而是能看见 workspace data write 与 internal action 执行的 follow-through。

### 3.4 Settings governance surface 已能把 workspace data governance 讲清楚

当前 settings 的 org-admin governance surface，除了原有治理 readout，还会显式表达：

- workspace record writes 当前是 enabled 还是 read-only
- internal action approve / execute 当前是 enabled 还是 read-only
- workspace record writes / 30d
- internal actions / 30d
- latest workspace data activity
- latest internal action activity

这让 operator 能从同一个治理面里看见：

- capability posture
- 30 天 follow-through
- latest audit marker

而不是只能在业务页面里被动碰到 server deny。

## 4. 已成形但仍需下一层

- shared workspace-data-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- org-admin support-pack 已能解释 workspace data governance 与 internal action follow-through，但还不是完整 governance center
- settings governance surface 已能讲清这组 workspace data 主链路，但还不是完整 tenant-admin console
- tenant isolation 继续保持 application-layer workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader workflow / execution surface
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 workspace data / non-memory / non-import / non-commercial 的高风险 write path
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation
- org-admin support-pack 仍然是 tenant-scoped governance snapshot，不应误写成完整 tenant-admin platform
- recommendation 线里的 governed action generation 还没有全部进入这轮 workspace-data-governance seam，不应误写成“所有 recommendation write 都已统一收口”

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 workspace data governance deeper slice
- Helm 已把一批剩余的 tenant-sensitive workspace data write path 和 customer-success internal action 执行纳入 shared capability seam，并把 follow-through 补进 tenant-scoped org-admin support-pack
- Helm 的 settings governance surface 已能以 capability-aware、review-first 的方式展示 workspace data governance posture 与 latest audit marker
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 broader tenant-admin platform、workflow/execution surface 或 execution-authority expansion

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余高风险 write path 的 capability matrix
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
