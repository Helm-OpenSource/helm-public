---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Broader Capability Matrix And Org Admin Export Follow-through Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第四层治理收紧上的真实边界。

本基线只回答四件事：

1. remaining high-risk memory-domain write paths 已推进到了哪一层
2. org-admin export / retention / delete follow-through 已成立到了哪一层
3. settings 中的 tenant-scoped export / delete / retention follow-through 已成立到了哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
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

### 3.1 Remaining high-risk memory-domain write paths

当前 broader capability matrix 已经从 PR44 的 governance slice 再推进一层：

- `canManageWorkspaceMemory` 现在是 remaining high-risk memory-domain write paths 的统一 capability seam
- direct server routes 和 server actions 都会先验证 active workspace session，再验证 fixed-role capability
- capability 被拒绝时统一落到 `getMemoryManagementDeniedMessage`

当前已统一回到 capability matrix 的真实路径包括：

- `/api/memory/facts`
- `/api/memory/facts/:id/confirm`
- `/api/memory/meetings/:meetingId/process`
- `/api/memory/imports/meeting-notes/process`
- `/api/commitments`
- `/api/commitments/:id/status`
- `/api/blockers`
- `/api/blockers/:id/resolve`
- `/api/blockers/:id/status`
- `/api/llm/meetings/:meetingId/process-memory`
- `features/memory/actions.ts`
- `features/meetings/actions.ts`

当前这层已经由 `write-governance-routes.test.ts` 覆盖 direct route 的 deny / allow truth。

### 3.2 Org-admin export follow-through

当前 tenant-scoped org-admin governance summary 已经从“support-pack 可导出”推进到“follow-through 可解释”：

- `getOrgAdminGovernanceSummary` 现在会返回 `governanceFollowThrough`
- `dataGovernanceSummary` 现在会显式输出：
  - `exportActionCount30d`
  - `deleteActionCount30d`
  - `retentionUpdateCount30d`
  - `settlementBatchExportCount30d`
- `governanceFollowThrough` 现在会显式输出：
  - `latestExportAudit`
  - `latestDeleteAudit`
  - `latestRetentionAudit`

这意味着 org-admin support pack 不再只回答“最近有哪些治理动作”，还会回答“tenant-scoped export / delete / retention follow-through 最近发生了什么”。

### 3.3 Settings governance readout

settings 现在已经能把 org-admin export follow-through 读成 operator-readable posture，而不是零散 audit：

- `organizationGovernance`
- `organization-support-pack-download`
- export / delete / retention / settlement export 30d counts
- latest export / delete / retention audit marker

这层继续保持 tenant-scoped，不做跨 workspace 聚合，也不把治理 readout 写成自动执行权。

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 remaining high-risk memory-domain write paths，但还没有覆盖全产品所有高风险 write path
- org-admin export follow-through 已成立，但还不是完整治理中心或 support tooling
- tenant-scoped export / delete / retention follow-through 已成立，但还不是 storage-level tenant isolation
- retention / export / delete posture 已经可读，但还不是完整 per-workspace policy engine

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- cross-tenant support tooling
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 memory-domain 的 high-risk write path，避免 future drift
- org-admin export follow-through 仍然是 tenant-scoped governance snapshot，不是完整 support workflow
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成完整 enterprise tenant isolation
- retention / delete governance 目前以 posture + audit 为主，还不是完整治理平台

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 broader capability matrix and org-admin export follow-through
- Helm 已能对 remaining high-risk memory-domain write paths 做 fixed-role capability guard，并对 tenant-scoped export / delete / retention follow-through 给出集中 readout
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 cross-tenant support tooling
- Helm 当前仍然不拥有 broader execution authority

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余非 memory-domain 的高风险 write path capability matrix
2. org-admin export / retention / support pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
