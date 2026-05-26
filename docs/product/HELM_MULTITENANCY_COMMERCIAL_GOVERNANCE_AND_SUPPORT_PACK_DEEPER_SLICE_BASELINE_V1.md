---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Commercial Governance And Support-Pack Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第八层治理收紧上的真实边界。

本基线只回答四件事：

1. billing / registry / participant portal / program application 这组剩余商业治理写路径已经统一到哪一层
2. org-admin support-pack 对 participant self-service 与 program governance follow-through 已成立到哪一层
3. settings governance surface 对商业治理域的 readout 已成立到哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- finance or marketplace platform
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

### 3.1 Shared commercial-governance seam 已成立

当前 billing / contribution registry / participant portal / program application 这组商业治理主链路，已经从多个 helper 再收回一层：

- `canManageWorkspaceBilling`
- `canReadContributionRegistry`
- `canManageContributionRegistry`
- `canManageManualSettlement`
- `canManageParticipantPortal`
- `canManageProgramApplications`

以及对应 denial messaging：

- `getBillingManagementDeniedMessage`
- `getContributionRegistryManagementDeniedMessage`
- `getManualSettlementManagementDeniedMessage`
- `getParticipantPortalManagementDeniedMessage`
- `getProgramApplicationManagementDeniedMessage`

这些 helper 现在成为 billing、registry、participant portal、program governance 这组 tenant-scoped fixed-role seam。旧 helper 文件仍在，但已经退化为兼容 re-export，不再各自维护独立 capability 逻辑。

### 3.2 Org-admin support-pack 已能解释 participant self-service 与 program governance follow-through

当前 `getOrgAdminGovernanceSummary` 已把以下 participant / program follow-through 补齐：

- `participantPortalActionCount30d`
- `programActionCount30d`
- `latestParticipantPortalAudit`
- `latestProgramAudit`

同时，participant portal governance 不再只覆盖 access issue / status update，也已经把：

- `CONTRIBUTOR_PORTAL_ONBOARDED`
- `CONTRIBUTOR_PORTAL_PROFILE_UPDATED`

纳入 support-pack 的 tenant-scoped governance truth。

program governance 也不再只覆盖 review / invite，而是把：

- `PROGRAM_APPLICATION_SUBMITTED`
- `PROGRAM_APPLICATION_REVIEWED`
- `PROGRAM_APPLICATION_INVITE_ISSUED`

作为完整 follow-through 链的一部分纳入 org-admin snapshot。

### 3.3 Settings governance surface 已能把商业治理域讲完整

当前 settings 的 org-admin governance surface，除了原有 billing / registry / settlement posture，还会显式表达：

- participant portal 当前是 manage 还是 read-only
- program governance 当前是 manage 还是 read-only
- latest participant portal activity
- latest program activity
- participant portal / program actions 在最近 30 天的计数

这让 operator 不再只看到 review 之后的治理动作，而是能看到 participant self-service 与 program governance 的前后链路。

### 3.4 Support-pack 仍保持 tenant-scoped governance snapshot

`app/api/settings/org-admin/support-pack/route.ts` 继续保持 tenant-scoped private export，并且导出 payload 现在包含：

- `participantPortalActionCount30d`
- `programActionCount30d`

同时继续保留：

- `Cache-Control: private, no-store, max-age=0`
- `Vary: Cookie`
- `X-Robots-Tag: noindex, nofollow`

这层变化只增强治理可读性，不扩大 execution authority。

## 4. 已成形但仍需下一层

- shared commercial-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- org-admin support-pack 已能解释 participant self-service 与 program governance follow-through，但还不是完整 governance center
- settings governance surface 已能讲完整这组商业治理主链路，但还不是完整 tenant-admin console
- tenant-scoped export 继续保持 private/no-store，但 retention / delete 仍不是完整 policy engine

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- finance or marketplace platform
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 commercial-governance / non-memory / non-import / non-connector 的高风险 write path
- org-admin support-pack 仍然是 tenant-scoped governance snapshot，不应误写成完整 tenant-admin platform
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成 storage-level isolation
- 如果后续新增 participant/program 商业治理写路径却不复用 shared commercial-governance seam，权限 drift 仍可能回来

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 commercial governance and support-pack deeper slice
- Helm 已把 billing / registry / participant portal / program governance 收回 shared commercial-governance seam，并把 participant self-service 与 program governance follow-through 补进 tenant-scoped org-admin support-pack
- Helm 的 settings governance surface 已能把 participant / program 这组商业治理主链路以 capability-aware、review-first 的方式展示出来
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant、也没有扩成 broader tenant-admin platform、finance or marketplace platform 或 execution authority expansion

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余高风险 write path 的 capability matrix
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
