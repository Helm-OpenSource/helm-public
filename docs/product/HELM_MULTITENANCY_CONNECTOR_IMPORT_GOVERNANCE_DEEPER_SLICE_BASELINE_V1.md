---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Connector Import Governance Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第五层治理收紧上的真实边界。

本基线只回答四件事：

1. connector / import ingress 高风险写路径已推进到了哪一层
2. org-admin support pack 对 connector / import follow-through 已成立到了哪一层
3. imports / CRM / conflicts / import-result surface 的 capability-aware posture 已成立到了哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- cross-tenant connector governance center
- broader import orchestration platform
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

### 3.1 Connector / import ingress capability guard

当前 broader capability matrix 已经从 PR45 的 memory-domain / org-admin export follow-through 再推进一层：

- `canManageWorkspaceConnectors`
- `canManageWorkspaceImports`
- `canResolveWorkspaceImportConflicts`

这些 capability 现在已统一成为 connector / import ingress 高风险路径的 tenant-scoped guard。

当前真实覆盖路径包括：

- `features/connectors/actions.ts`
- `features/imports/actions.ts`
- `features/imports/crm-actions.ts`
- `/api/connectors/google/start`
- `/api/connectors/google/callback`
- `/api/connectors/hubspot/start`
- `/api/connectors/hubspot/callback`
- `/api/connectors/salesforce/start`
- `/api/connectors/salesforce/callback`
- `/api/imports/crm/preview`
- `/api/imports/crm/run`
- `/api/imports/crm/sync`
- `/api/imports/jobs/:jobId/warmup`
- `/api/imports/conflicts/:id/resolve`

deny posture 现在统一落到：

- `getConnectorManagementDeniedMessage`
- `getImportManagementDeniedMessage`
- `getImportConflictResolutionDeniedMessage`

这意味着 connector / import ingress 已不再只依赖 active workspace session，而是会继续验证 fixed-role capability。

### 3.2 Org-admin support pack 的 connector / import follow-through

当前 `getOrgAdminGovernanceSummary` 已经把 connector / import follow-through 补成 tenant-scoped governance truth：

- `connectorActionCount30d`
- `connectorConnectionCount30d`
- `connectorSyncCount30d`
- `connectorDisconnectCount30d`
- `importActionCount30d`
- `csvImportCount30d`
- `crmImportCount30d`
- `importWarmupCount30d`
- `importConflictResolutionCount30d`
- `importSourceConnectionCount30d`
- `importSourceDisconnectCount30d`

`governanceFollowThrough` 现在也会显式输出：

- `latestConnectorAudit`
- `latestImportAudit`
- `latestConflictResolutionAudit`

这让 org-admin support pack 不再只解释 export / delete / retention，而是能把 connector / import ingress follow-through 一并读成 tenant-scoped governance snapshot。

### 3.3 Capability-aware operator posture

imports / CRM / conflicts / import-result surface 现在已经能把权限不足表达成 capability-aware read-only posture，而不是让 operator 只能看到普通错误：

- `ImportsClient`
- `CrmImportClient`
- `ImportConflictsClient`
- `ImportJobDetailClient`

当前这些 surface 已成立的真实表达包括：

- capability 不足时显式显示 operator-facing note
- capability 不足时按钮 disabled，而不是继续提交高风险写动作
- conflicts resolve 现在会明确表达 `read-only / review-first` posture
- imports / CRM surface 仍保持 ingress-first，不写成 workflow 或 execution authority

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 connector / import ingress 主路径，但仍未覆盖全产品所有剩余高风险 write path
- org-admin support pack 已能解释 connector / import follow-through，但还不是完整 governance center
- imports / CRM surface 已具备 capability-aware posture，但还不是完整 tenant-admin console
- tenant isolation 已继续收紧，但仍然不是 storage-level isolation

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- cross-tenant connector governance center
- broader import orchestration platform
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 connector / import / memory-domain 的高风险 write path
- connector / import governance 仍然是 tenant-scoped snapshot，不应误写成完整 admin platform
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成完整 enterprise tenant isolation
- imports / CRM surface 如果后续新增 readout 不复用当前 denial messaging 和 capability seam，权限 drift 仍可能回来

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 connector / import governance deeper slice
- Helm 已能对 connector / import ingress 高风险路径做 fixed-role capability guard，并把 connector / import follow-through 补进 tenant-scoped org-admin governance snapshot
- Helm 已在 imports / CRM / conflicts surface 上建立 capability-aware read-only posture，避免把授权问题伪装成系统故障
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 connector governance center 或 import orchestration platform

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余非 connector / import / memory-domain 的高风险 write path capability matrix
2. org-admin export / retention / support-pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
