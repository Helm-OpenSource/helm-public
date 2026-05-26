---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Tenant Governance And Org Admin Audit Report V1

## 1. 结论

PR44 把 Helm 当前主干的多租户 / 多用户控制面，从“broader capability coverage + tenant-scoped memory control + recent org-admin audit truth”收紧到了“program governance capability、tenant-scoped org-admin support pack、data-governance posture readout”的第三层可冻结版本。

当前这轮已经完整成立：

- program application review / invite issuance 已进入 centralized capability matrix
- org-admin support pack export 已 tenant-scoped、capability-guarded、audit-logged
- settings 已具备 retention / auth-session / export-delete / audit 的 tenant-scoped governance readout

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
  - `workspace.manage_program_applications`
  - `workspace.export_admin_support_pack`
- `features/programs/actions.ts` 的 review / invite 写路径不再只依赖 scattered role checks

### 2.2 Org-admin governance summary and support pack

- 新增 `lib/auth/org-admin-governance.ts`
- 新增 `/api/settings/org-admin/support-pack`
- support pack export 现在需要 capability guard
- support pack export 会写入 `ORGANIZATION_SUPPORT_PACK_EXPORTED`
- support pack summary 现在会输出：
  - workspace / retention posture
  - membership summary
  - auth-session summary
  - recent org-admin audit
  - recent data-governance audit
  - governance boundary notes

### 2.3 Tenant-scoped governance readout in settings

- `features/settings/queries.ts` 现在会返回 `organizationGovernance`
- settings surface 现在支持：
  - current governance posture
  - recent active auth sessions
  - recent data-governance audit
  - support-pack download entry
- program application queue 现在会对无 capability 的角色显式暴露 read-only posture

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

- `npm run test` -> `101 files / 406 tests passed`
- `npm run e2e` -> `21 passed`
- `npm run quality:regression` -> `51 files / 180 tests passed`

本轮还修掉了两个真实问题：

1. worktree 里的依赖副本缺失导致 `typecheck` / `vitest` 无法执行；当前验证改用 worktree 本地 `node_modules`
2. `formal-trial-flow` 需要精确校验 support pack 可见与下载；当前 e2e 已补上 `organization-support-pack` 与 `organization-support-pack-download` 断言

## 4. 已成形但仍需下一层

- capability matrix 已覆盖第三层高风险面，但仍未覆盖所有 write path
- org-admin support pack 已成立，但还不是完整 tenant governance center
- tenant-scoped governance readout 已成立，但还不是 storage-level tenant isolation
- retention / export / delete posture 仍需要和更完整的 support / policy pack 协同收紧

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
- current tenant isolation 仍然主要依赖 workspace scoping
- org-admin support pack 还缺更完整的 export / retention / support follow-through
- governance readout 还需要继续与 retention / delete policy 收紧协同

下一阶段如继续推进，优先顺序应是：

1. broader capability coverage on remaining write path
2. org-admin audit / export / retention / support pack
3. tenant isolation / export / retention / delete governance
4. enterprise layer deferred review
