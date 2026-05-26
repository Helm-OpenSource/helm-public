---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Broader Capability Matrix And Org Admin Export Follow-through Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第六层治理收紧上的真实边界。

本基线只回答四件事：

1. settings 内 billing / contribution registry / participant portal / manual settlement 的高风险治理写路径已推进到了哪一层
2. org-admin governance support pack 对 billing / registry / participant portal / settlement follow-through 已成立到了哪一层
3. settings 中 capability-aware manage/read-only posture 已成立到了哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- finance or marketplace platform
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

### 3.1 Settings governance write paths 已统一回到 capability helper

当前 broader capability matrix 已经从 PR46 的 connector / import ingress deeper slice 再推进一层：

- `canManageWorkspaceBilling`
- `canManageContributionRegistry`
- `canManageManualSettlement`
- `canManageParticipantPortal`

以及对应 denial messaging helper：

- `getBillingManagementDeniedMessage`
- `getContributionRegistryManagementDeniedMessage`
- `getManualSettlementManagementDeniedMessage`
- `getParticipantPortalManagementDeniedMessage`

这些 helper 现在已经成为 settings 内 billing / registry / participant portal / manual settlement 高风险治理写路径的 tenant-scoped fixed-role seam。

当前真实接入路径包括：

- `createBillingCheckoutAction`
- `createBillingPortalAction`
- `refreshBillingStatusAction`
- `createWorkerPublisherProfileAction`
- `updateWorkerPublisherProfileStatusAction`
- `createSalesReferralAction`
- `updateSalesReferralStatusAction`
- `createCustomEngagementAction`
- `updateCustomEngagementStatusAction`
- `createBeneficiaryPayoutProfileAction`
- `updateBeneficiaryPayoutProfileStatusAction`
- `createSettlementBatchAction`
- `approveSettlementBatchAction`
- `exportSettlementBatchCsvAction`
- `markSettlementLinePaidAction`
- `reverseSettlementLineAction`
- `closeSettlementBatchAction`

### 3.2 Settings 已具备 capability-aware manage/read-only posture

settings 中与 billing / registry / participant portal / manual settlement 相关的 surface 现在都会显式暴露 manage/read-only posture，而不是继续只靠 server-side 拒绝：

- billing overview
- contributor registry
- beneficiary payout profiles
- participant portal access
- manual settlement workflow
- org-admin support pack

当前这些 surface 已成立的真实表达包括：

- capability 不足时显式显示 read-only / operator-facing note
- 高风险按钮 disabled，而不是继续把授权失败留到 server response
- organization summary 现在会显式返回：
  - `canManageBilling`
  - `canManageContributionRegistry`
  - `canManageManualSettlement`
  - `canManageParticipantPortal`

### 3.3 Org-admin support pack 已能解释 billing / registry / portal / settlement follow-through

当前 `getOrgAdminGovernanceSummary` 已经把 billing / registry / participant portal / settlement follow-through 补成 tenant-scoped governance snapshot：

- `billingActionCount30d`
- `contributionRegistryActionCount30d`
- `participantPortalActionCount30d`
- `settlementActionCount30d`

`governanceFollowThrough` 现在也会显式输出：

- `latestBillingAudit`
- `latestContributionRegistryAudit`
- `latestParticipantPortalAudit`
- `latestSettlementAudit`

这让 org-admin support pack 不再只解释 export / delete / retention / connector / import posture，而是能把 billing / registry / participant portal / manual settlement 的 follow-through 一并读成 tenant-scoped governance snapshot。

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 settings 内这批高风险治理写路径，但仍未覆盖全产品所有剩余高风险 write path
- org-admin governance support pack 已能解释 billing / registry / participant portal / settlement follow-through，但还不是完整 governance center
- settings 已具备 capability-aware manage/read-only posture，但还不是完整 tenant-admin console
- tenant isolation 已继续收紧，但仍然不是 storage-level isolation

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- finance or marketplace platform
- cross-tenant support tooling
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 settings / non-memory / non-import 的高风险 write path
- org-admin support pack 仍然是 tenant-scoped governance snapshot，不应误写成 finance or marketplace platform
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成完整 enterprise tenant isolation
- 如果后续新增 settings governance 写路径但不复用当前 capability seam，权限 drift 仍可能回来

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 broader capability matrix and org-admin export follow-through deeper slice
- Helm 已能对 settings 内 billing / contribution registry / participant portal / manual settlement 高风险治理写路径做 fixed-role capability guard，并把这些域的 recent follow-through 补进 tenant-scoped org-admin governance snapshot
- Helm 已在 settings surface 上建立 capability-aware manage/read-only posture，避免把授权问题伪装成系统故障
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 finance or marketplace platform 或 cross-tenant support tooling

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余非 settings / non-memory / non-import 的高风险 write path capability matrix
2. org-admin export / retention / support-pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
