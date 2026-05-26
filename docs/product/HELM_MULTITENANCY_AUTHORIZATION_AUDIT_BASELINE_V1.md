---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Authorization And Org Admin Audit Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第二层收紧上的真实边界。

本基线只回答四件事：

1. PR42 之后，fixed-role capability matrix 又往前成立到了哪一层
2. tenant-scoped memory export / correction / delete 已经被收紧到了哪一层
3. org-admin role change / recent audit 已经成立到了哪一层
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

### 3.1 Broader capability coverage

当前 fixed-role capability matrix 已经从 PR42 的 first slice 扩到第二层高风险写路径：

- `workspace.manage_policies`
- `workspace.manage_workspace_setup`
- `workspace.manage_operational_controls`
- `workspace.export_memory`
- `workspace.manage_memory_facts`
- `workspace.read_admin_audit`

这层已经接到当前主干的真实路径：

- settings policy update / restore defaults
- workspace setup update
- workspace operational controls update
- memory export
- memory fact correct / invalidate / delete
- org-admin recent audit read path

当前高风险路径不再只靠散落的 `role === ...` 判断拼装。

### 3.2 Tenant-scoped memory control

当前 tenant-scoped memory export / correction / delete 已经收紧到 capability-guarded 的第二层：

- `/api/memory/export` 现在需要 `workspace.export_memory`
- memory fact correct / invalidate / delete route 现在需要 `workspace.manage_memory_facts`
- memory entry / fact correction service 现在按 `workspaceId` 查找，不再只按全局 `id` 查找
- memory page 会暴露 read-only posture，而不是只在提交时失败
- memory summary export 现在会留下 `MEMORY_SUMMARY_EXPORTED` audit log

### 3.3 Org-admin audit and lifecycle follow-through

当前 org-admin 第二层已经成立：

- role change
- direct owner assignment guard
- last-owner demotion guard
- recent org-admin audit feed

当前 role change 规则保持窄边界：

- 只有有成员管理能力的角色能发起角色切换
- generic role change 不允许直接把成员提升为 `OWNER`
- 最后一个 active owner 不能被直接降级
- recent org-admin audit feed 只暴露最近组织管理员动作，不扩成完整 governance center

## 4. 已成形但仍需下一层

- capability matrix 已覆盖第二层高风险路径，但还没有覆盖所有 write path
- org-admin audit 已有 recent feed，但还不是完整 audit pack / export pack
- memory control 已收紧到 export / fact-management 主路径，但还不是完整 retention / deletion governance
- tenant isolation 仍然是 application-layer workspace scoping，不是 storage-level tenant isolation

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- SSO / SAML / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- cross-tenant support tooling
- broader execution authority

## 6. 风险项

- capability matrix 仍需继续覆盖更多 high-risk write path，避免 future drift
- recent org-admin audit 还不是完整 support / export / retention 审计包
- memory export / fact management 仍需继续和 retention / support pack 协同收紧
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成完整 enterprise tenant isolation

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的第二层 capability 收紧
- Helm 已具备 tenant-scoped memory export / fact-management guard 和 recent org-admin audit readout
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant、多租户平台也没有扩成 cross-tenant support tooling
- Helm 当前仍然不拥有 broader execution authority

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. broader capability coverage on remaining high-risk write path
2. richer org-admin audit / lifecycle pack
3. tenant isolation / export / retention / support pack
4. enterprise layer only under explicit demand
