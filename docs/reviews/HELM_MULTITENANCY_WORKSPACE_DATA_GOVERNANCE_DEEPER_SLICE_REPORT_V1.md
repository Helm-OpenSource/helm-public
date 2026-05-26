---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Workspace Data Governance Deeper Slice Report V1

## 1. 结论

PR50 把 Helm 当前主干的多租户 / 多用户控制面，从“shared commercial-governance seam + participant/program follow-through + capability-aware commercial governance readout”继续收紧到了“shared workspace-data-governance seam + tenant-scoped record validation + workspace data follow-through readout”的第九层可冻结版本。

当前这轮已经完整成立：

- workspace / opportunities / inbox / contacts / companies / customer-success handoff 的剩余高风险 tenant-sensitive 写路径已进入 shared workspace-data-governance seam
- owner / company / contact / thread / memory entry 等关键引用已补 tenant-scoped 校验
- org-admin governance support-pack 已能输出 workspace data governance 与 internal action follow-through
- settings governance surface 已能解释 workspace record writes / internal action posture 与对应 latest marker

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader workflow / execution surface
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared workspace-data-governance seam

- 新增 `lib/auth/workspace-data-governance.ts`
- 新增 `lib/auth/workspace-data-governance.test.ts`
- `lib/auth/authorization.ts` 新增：
  - `workspace.manage_workspace_records`
  - `workspace.manage_internal_actions`

当前真实统一的 helper 包括：

- `canManageWorkspaceRecords`
- `canManageWorkspaceInternalActions`
- `getWorkspaceRecordManagementDeniedMessage`
- `getWorkspaceInternalActionDeniedMessage`
- `getWorkspaceScopedRecordUnavailableMessage`
- `getWorkspaceAssignableOwnerDeniedMessage`
- `resolveWorkspaceAssignableOwnerId`

角色边界继续保持 fixed-role：

- `OWNER / ADMIN / OPERATOR` 可管理 workspace data write / internal actions
- `BILLING_ADMIN / REVIEWER / MEMBER` 不可管理这组高风险写路径

### 2.2 Workspace data write path 已 capability 化并补 tenant-scoped 引用校验

本轮接入的核心 action 包括：

- `features/workspace/actions.ts`
- `features/opportunities/actions.ts`
- `features/inbox/actions.ts`
- `features/contacts/actions.ts`
- `features/companies/actions.ts`
- `features/customer-success-handoff/actions.ts`

当前真实变化：

- direct tenant-sensitive write path 会先检查 capability，再执行写入
- `ownerId` 只有在当前 workspace 里是有效成员时才允许写入
- `companyId / contactId / opportunityId / threadId / entryId` 会先做 workspace-scoped existence check
- contact memory append / working memory add 已重新纳入 memory governance
- customer-success internal execute 现在会明确写 `CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED`

这层变化的目标是减少“知道别的租户对象 id 就能带进当前 workspace 写链路”的风险。

### 2.3 Workspace data follow-through 进入 org-admin governance snapshot

`lib/auth/org-admin-governance.ts` 现在新增：

- `WORKSPACE_DATA_GOVERNANCE_AUDIT_ACTION_TYPES`
- `INTERNAL_ACTION_GOVERNANCE_AUDIT_ACTION_TYPES`
- `workspaceDataActionCount30d`
- `internalActionCount30d`
- `latestWorkspaceDataAudit`
- `latestInternalActionAudit`

并把 `MEMORY_ADDED` 纳入 memory governance truth。

这让 support-pack 不再只偏向 settings / import / commercial / memory 主链，而是能看见 workspace data write 和 customer-success internal action 这条真实 follow-through。

### 2.4 Settings governance surface 已补 capability-aware readout

`features/settings/queries.ts` 和 `features/settings/settings-client.tsx` 现在会显式暴露：

- `canManageWorkspaceRecords`
- `canManageInternalActions`
- workspace record writes / 30d
- internal actions / 30d
- latest workspace data activity
- latest internal action activity

这仍然只是 governance readout，不是新的 tenant-admin platform，也不是 execution surface。

## 3. 验证结果

本轮最终全量验证已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

补充的窄验证也已通过：

- `npm run test -- lib/auth/authorization.test.ts lib/auth/workspace-data-governance.test.ts lib/auth/org-admin-governance.test.ts`
- `npm run typecheck`

最终结果：

- `npm run test` -> `113 files / 440 tests passed`
- `npm run e2e` -> `21 passed (2.0m)`
- `npm run quality:regression` -> `51 files / 180 tests passed`

## 4. 已成形但仍需下一层

- shared workspace-data-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- org-admin support-pack 已能解释 workspace data governance 与 internal action follow-through，但还不是完整 governance center
- settings governance surface 已能讲清这组 workspace data 主链路，但还不是完整 tenant-admin console
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader workflow / execution surface
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

- capability matrix 还需要继续覆盖剩余高风险 write path
- tenant isolation 仍主要依赖 workspace scoping
- org-admin support-pack 仍是 tenant-scoped governance snapshot，不是完整治理中心
- recommendation 线里的 governed action generation 还没有全部进入这轮 workspace-data-governance seam

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
