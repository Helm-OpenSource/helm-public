---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Authorization And Org Admin Audit Report V1

## 1. 结论

PR43 把 Helm 当前主干的多租户 / 多用户控制面，从“有 session truth 与 first-slice capability truth”收紧到了“更广 capability coverage、tenant-scoped memory control、recent org-admin audit truth”的第二层可冻结版本。

当前这轮已经完整成立：

- broader fixed-role capability coverage on high-risk settings and memory paths
- tenant-scoped memory export / correction / delete control
- org-admin role change + last-owner demotion guard + recent audit feed

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- cross-tenant support tooling
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Broader capability coverage

- 扩展 `lib/auth/authorization.ts`
- 新增：
  - `workspace.manage_policies`
  - `workspace.manage_workspace_setup`
  - `workspace.manage_operational_controls`
  - `workspace.export_memory`
  - `workspace.manage_memory_facts`
  - `workspace.read_admin_audit`
- settings 的 policy / setup / operational controls 写路径不再只依赖 scattered role checks

### 2.2 Tenant-scoped memory control

- 新增 `lib/memory/permissions.ts`
- memory page 现在会暴露 capability-aware read-only posture
- `/api/memory/export` 现在需要 `workspace.export_memory`
- memory fact correct / invalidate / delete route 现在需要 `workspace.manage_memory_facts`
- memory entry / fact lookup 改为按 `workspaceId` 收紧
- memory export 现在会记录 `MEMORY_SUMMARY_EXPORTED`

### 2.3 Org-admin audit and lifecycle follow-through

- 新增 `validateMembershipRoleTransition`
- 新增 direct owner assignment guard
- 新增 last-owner demotion guard
- settings permissions surface 现在支持 role change
- settings 现在可读 recent org-admin audit feed
- role change 会写入 `ORGANIZATION_MEMBER_ROLE_UPDATED`

## 3. 验证结果

本轮最终已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test -- lib/auth/authorization.test.ts lib/auth/membership-lifecycle.test.ts lib/memory/permissions.test.ts lib/auth/session.test.ts`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

最终结果：

- `npm run test` -> `101 files / 406 tests passed`
- `npm run e2e` -> `21 passed`
- `npm run quality:regression` -> `51 files / 180 tests passed`

本轮还修掉了两个 worktree / 回归层面的真实问题：

1. Turbopack 不接受指向 worktree 外部的 `node_modules` 符号链接；当前验证使用 worktree 本地依赖副本与本地 `prisma generate`
2. `formal-trial-flow` 因 PR43 新增的成员角色下拉而出现 selector 歧义，已改成 `data-testid` 精确选择器

## 4. 已成形但仍需下一层

- capability matrix 已覆盖第二层高风险面，但仍未覆盖所有 write path
- org-admin recent audit 已成立，但还不是完整 audit / export / support pack
- tenant-scoped memory control 已成立，但还不是完整 retention / delete governance
- tenant isolation 仍然是 application-layer workspace scoping，不是 storage-level tenant isolation

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
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

- capability matrix 还需要继续覆盖更多 high-risk write path
- recent org-admin audit 还缺更完整的 export / support / retention pack
- current tenant isolation 仍然主要依赖 workspace scoping
- memory control 还需要和更完整的 retention / delete policy 协同

下一阶段如继续推进，优先顺序应是：

1. broader capability coverage on remaining write path
2. org-admin audit pack
3. tenant isolation / export / retention / support pack
4. enterprise layer deferred review
