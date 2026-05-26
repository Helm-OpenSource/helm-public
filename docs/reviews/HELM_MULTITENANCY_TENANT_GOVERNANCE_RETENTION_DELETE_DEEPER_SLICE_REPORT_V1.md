---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Tenant Governance Retention Delete Deeper Slice Report V1

## 1. 结论

PR48 把 Helm 当前主干的多租户 / 多用户控制面，从“connector / import governance deeper slice + broader settings capability follow-through”收紧到了“settings governance shared seam + membership/workspace/auth-session/support-pack follow-through + private tenant-scoped export hardening”的第七层可冻结版本。

当前这轮已经完整成立：

- settings/governance 剩余散落 capability 判断已统一回 shared helper
- org-admin governance summary 已能输出 membership / workspace governance / auth-session / support-pack follow-through
- tenant-scoped memory export 和 org-admin support-pack export 已收紧成 private / no-store governance export
- settings 已具备更完整的 capability-aware governance posture

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared settings-governance seam

- 新增 `lib/auth/settings-governance.ts`
- 新增 `lib/auth/settings-governance.test.ts`
- `features/settings/actions.ts` 现在把成员治理、policy、workspace setup、operational controls 的局部 helper 收回统一 capability seam
- `features/settings/queries.ts` 现在也复用同一层 helper，不再在 query 层重新维护一套 capability 判断

本轮真实统一的 helper 包括：

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

### 2.2 Membership / workspace governance / auth-session / support-pack follow-through

- `lib/auth/org-admin-governance.ts` 现在新增：
  - `membershipActionCount30d`
  - `workspaceGovernanceActionCount30d`
  - `latestMembershipAudit`
  - `latestWorkspaceGovernanceAudit`
  - `latestAuthSessionAudit`
  - `latestSupportPackAudit`
- `features/settings/settings-client.tsx` 现在会把这些计数和 latest marker 直接暴露到 org-admin governance surface
- `app/api/settings/org-admin/support-pack/route.ts` 现在会把这些 follow-through 指标写进 audit payload

### 2.3 Tenant-scoped export route hardening

- `app/api/memory/export/route.ts` 现在显式输出：
  - `Cache-Control: private, no-store, max-age=0`
  - `Vary: Cookie`
  - `X-Robots-Tag: noindex, nofollow`
- `app/api/settings/org-admin/support-pack/route.ts` 现在同样显式输出 `Vary: Cookie` 和 `X-Robots-Tag: noindex, nofollow`
- 新增 `lib/memory/export-route.test.ts`，把 deny / allow 和导出头部都锁进 route 级测试

### 2.4 Capability-aware settings governance posture

- `organizationSummary` 现在新增 `canManageWorkspaceSetup`
- org-admin governance surface 现在除了 billing / registry / portal / settlement、connector / import posture外，也会显式表达：
  - member lifecycle
  - workspace setup
  - policies
  - operational controls
  - support-pack export
  的 manage/read-only posture

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

最终结果会在本轮收口时写入：

- `npm run test` -> `111 files / 435 tests passed`
- `npm run e2e` -> `21 passed (2.0m)`
- `npm run quality:regression` -> `51 files / 180 tests passed`

## 4. 已成形但仍需下一层

- broader capability matrix 已继续覆盖 settings/governance 剩余散落 helper，但仍未覆盖全产品剩余所有高风险 write path
- org-admin governance follow-through 已能解释 membership / workspace governance / auth-session / support-pack，但还不是完整 governance center
- tenant-scoped export / delete / retention route 已更明确地私有化，但还不是完整 retention / delete policy engine
- settings 已具备更完整的 capability-aware governance posture，但还不是完整 tenant-admin console

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- cross-tenant support tooling
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

- capability matrix 还需要继续覆盖剩余非 settings / non-memory / non-import / non-connector 的高风险 write path
- tenant isolation 仍主要依赖 workspace scoping
- org-admin support-pack 仍是 tenant-scoped governance snapshot，不是完整 governance center
- settings governance 后续若新增写动作但不复用当前 shared seam，权限 drift 会回来

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
