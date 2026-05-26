---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Commercial Governance And Support-Pack Deeper Slice Report V1

## 1. 结论

PR49 把 Helm 当前主干的多租户 / 多用户控制面，从“settings governance shared seam + membership/workspace/auth-session/support-pack follow-through + private tenant-scoped export hardening”继续收紧到了“shared commercial-governance seam + participant/program follow-through + capability-aware commercial governance readout”的第八层可冻结版本。

当前这轮已经完整成立：

- billing / registry / participant portal / program application 已收回 shared commercial-governance seam
- org-admin governance support-pack 已能输出 participant self-service 与 program governance follow-through
- settings governance surface 已能解释 latest participant/program activity 与对应 30d 计数
- support-pack export 仍保持 tenant-scoped private governance snapshot，没有扩 execution authority

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- finance or marketplace platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared commercial-governance seam

- 新增 `lib/auth/commercial-governance.ts`
- 新增 `lib/auth/commercial-governance.test.ts`
- `lib/auth/billing-governance.ts`
- `lib/auth/revenue-governance.ts`
- `lib/auth/program-applications.ts`
- `lib/auth/participant-portal.ts`

当前真实统一的 helper 包括：

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

旧 helper 文件现在只保留兼容 re-export，避免 capability drift。

### 2.2 Participant/program follow-through 进入 org-admin governance snapshot

- `features/participant-portal/actions.ts` 新增 `CONTRIBUTOR_PORTAL_PROFILE_UPDATED`
- `features/programs/actions.ts` 新增 `PROGRAM_APPLICATION_SUBMITTED`
- `lib/auth/org-admin-governance.ts` 现在新增：
  - `programActionCount30d`
  - `latestProgramAudit`
- `PARTICIPANT_PORTAL_GOVERNANCE_AUDIT_ACTION_TYPES` 现在覆盖：
  - access issued
  - access status updated
  - onboarded
  - profile updated
- `PROGRAM_GOVERNANCE_AUDIT_ACTION_TYPES` 现在覆盖：
  - application submitted
  - application reviewed
  - invite issued

这让 support-pack 不再只偏向 review 后半段，而是把 participant self-service 与 program governance 的前半段也补进 tenant-scoped治理真值。

### 2.3 Capability-aware commercial governance readout

- `features/settings/queries.ts` 现在继续复用 shared commercial-governance seam
- `features/settings/settings-client.tsx` 现在会显示：
  - `Program actions / 30d`
  - latest participant portal activity
  - latest program activity
  - participant portal / program governance 当前是 enabled 还是 read-only

settings governance surface 现在能把商业治理域讲完整，而不是只读到 settlement 或 registry 后半段。

### 2.4 Support-pack export 继续保持 tenant-scoped private export

- `app/api/settings/org-admin/support-pack/route.ts` 的导出 payload 现在包含 `programActionCount30d`
- route 继续保持：
  - `Cache-Control: private, no-store, max-age=0`
  - `Vary: Cookie`
  - `X-Robots-Tag: noindex, nofollow`

这仍然只是 tenant-scoped governance snapshot，不是 broader tenant-admin platform。

## 3. 验证结果

本轮最终已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

最终结果：

- `npm run test` -> `112 files / 437 tests passed`
- `npm run e2e` -> `21 passed (1.9m)`
- `npm run quality:regression` -> `51 files / 180 tests passed`

## 4. 已成形但仍需下一层

- shared commercial-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- org-admin support-pack 已能解释 participant/program follow-through，但还不是完整 governance center
- settings governance surface 已能讲完整 participant/program 主链路，但还不是完整 tenant-admin console
- tenant-scoped export 继续保持 private/no-store，但 retention / delete 仍不是完整 policy engine

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- finance or marketplace platform
- broader execution authority

## 6. 保留边界

本轮继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 7. 风险与后续

当前主要风险仍然是：

- capability matrix 还需要继续覆盖剩余非 commercial-governance / non-memory / non-import / non-connector 的高风险 write path
- tenant isolation 仍主要依赖 workspace scoping
- org-admin support-pack 仍是 tenant-scoped governance snapshot，不是完整 governance center
- participant/program 后续若新增写动作但不复用 current shared seam，权限 drift 会回来

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
