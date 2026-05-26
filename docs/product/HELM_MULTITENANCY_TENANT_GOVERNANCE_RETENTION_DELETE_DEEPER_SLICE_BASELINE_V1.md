---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Tenant Governance Retention Delete Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第七层治理收紧上的真实边界。

本基线只回答四件事：

1. settings/governance 剩余散落 capability 判断已推进到哪一层
2. org-admin governance support-pack 对 membership / workspace governance / auth-session / support-pack follow-through 已成立到哪一层
3. tenant-scoped export / delete / retention route hardening 已推进到哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- cross-tenant support tooling
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

### 3.1 Settings/governance 剩余高风险治理写路径已统一回 shared helper

当前 settings/governance 这条治理主链路，已经从局部 helper 再收回一层：

- `canManageWorkspaceMembers`
- `canManageWorkspacePolicies`
- `canManageWorkspaceSetup`
- `canManageWorkspaceOperationalControls`
- `canReadWorkspaceAdminAudit`
- `canExportWorkspaceAdminSupportPack`

以及对应 denial messaging：

- `getMembershipManagementDeniedMessage`
- `getWorkspaceGovernanceDeniedMessage`
- `getAdminSupportPackExportDeniedMessage`

这些 helper 现在已经成为 settings 里成员治理、workspace governance、admin-audit/support-pack 的 tenant-scoped fixed-role seam。

当前真实接入路径包括：

- member invite / lifecycle / role change / owner transfer
- policy save / restore defaults
- workspace setup update
- workspace operational controls update
- org-admin support-pack export posture

### 3.2 Org-admin governance support-pack 已能解释 membership / workspace governance / auth-session / support-pack follow-through

当前 `getOrgAdminGovernanceSummary` 已经把以下 tenant-scoped governance truth 补齐：

- `membershipActionCount30d`
- `workspaceGovernanceActionCount30d`
- `authSessionEventCount30d`
- `supportPackExportCount30d`

`governanceFollowThrough` 现在也会显式输出：

- `latestMembershipAudit`
- `latestWorkspaceGovernanceAudit`
- `latestAuthSessionAudit`
- `latestSupportPackAudit`

这让 org-admin support-pack 不再只解释 export / delete / retention、billing / registry / portal / settlement、connector / import posture，而是能把 membership / workspace governance / auth-session / support-pack 自身也读成 tenant-scoped governance snapshot。

### 3.3 Tenant-scoped export route 已收紧为 private / no-store governance export

当前 tenant-scoped export route 已继续收紧：

- `app/api/settings/org-admin/support-pack/route.ts`
- `app/api/memory/export/route.ts`

这两条导出路径现在都会显式输出：

- `Cache-Control: private, no-store, max-age=0`
- `Vary: Cookie`
- `X-Robots-Tag: noindex, nofollow`

这层变化不会扩大 execution authority，只是把 tenant-scoped export / delete / retention 导出更明确地表达为私有治理导出，而不是普通可缓存响应。

### 3.4 Settings surface 已具备更完整的 capability-aware governance posture

settings 中的 org-admin governance surface 现在除了 billing / registry / portal / settlement、connector / import posture，还会显式表达：

- member lifecycle 当前是 manage 还是 read-only
- workspace setup 当前是 manage 还是 read-only
- policies 当前是 manage 还是 read-only
- operational controls 当前是 manage 还是 read-only
- support-pack export 当前是 enabled 还是 read-only

并且会显式展示：

- membership / workspace governance / auth-session / support-pack 的 30d 计数
- membership / workspace governance / auth-session / support-pack 的 latest audit marker

## 4. 已成形但仍需下一层

- broader capability matrix 已继续覆盖 settings/governance 剩余散落 helper，但仍未覆盖全产品所有剩余高风险 write path
- org-admin governance support-pack 已能解释 membership / workspace governance / auth-session / support-pack follow-through，但还不是完整 governance center
- tenant-scoped export / delete / retention route 已更明确地私有化，但还不是完整 retention / deletion policy engine
- settings governance surface 已具备更完整的 capability-aware posture，但还不是完整 tenant-admin console

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- cross-tenant support tooling
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 settings / non-memory / non-import / non-connector 的高风险 write path
- org-admin support-pack 仍然是 tenant-scoped governance snapshot，不应误写成完整 tenant-admin platform
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成 storage-level isolation
- 如果后续新增 settings governance 写路径但不复用当前 shared seam，权限 drift 仍可能回来

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 tenant governance retention delete deeper slice
- Helm 已把 settings/governance 剩余散落 capability 判断统一回 shared helper，并把 membership / workspace governance / auth-session / support-pack follow-through 补进 tenant-scoped org-admin governance snapshot
- Helm 已把 tenant-scoped export / delete / retention 导出进一步收紧为 private / no-store governance export
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 broader tenant-admin platform 或 cross-tenant support tooling

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余高风险 write path 的 capability matrix
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / delete / retention governance deeper slice
4. enterprise layer only under explicit demand
