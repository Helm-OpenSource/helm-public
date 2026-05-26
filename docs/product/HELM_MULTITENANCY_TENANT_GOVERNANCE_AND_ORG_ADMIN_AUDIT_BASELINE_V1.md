---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Tenant Governance And Org Admin Audit Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第三层治理收紧上的真实边界。

本基线只回答四件事：

1. broader capability coverage 这一轮又推进到了哪一层
2. org-admin support pack / governance summary 已经成立到了哪一层
3. tenant-scoped retention / export / delete / auth-session readout 已经成立到了哪一层
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

### 3.1 Broader capability coverage on remaining high-risk write paths

当前 fixed-role capability matrix 已经从 PR43 的 second slice 又推进一层：

- `workspace.manage_program_applications`
- `workspace.export_admin_support_pack`

这层已经接入当前主干的真实路径：

- `features/programs/actions.ts` 的 program application review
- `features/programs/actions.ts` 的 participant invite issuance
- `/api/settings/org-admin/support-pack`

当前这些高风险路径不再只靠散落的 `role === ...` 判断。

### 3.2 Org-admin governance summary and support-pack export

当前 tenant-scoped org-admin governance support pack 已经成立：

- support pack export route 需要 capability guard
- support pack export 会留下 `ORGANIZATION_SUPPORT_PACK_EXPORTED` 审计
- support pack summary 会输出：
  - workspace / retention posture
  - membership posture
  - auth-session posture
  - recent org-admin audit
  - recent data-governance audit
  - governance boundary notes

这层已经从“recent audit feed”推进成“可导出、可审计、可回看的治理快照”。

### 3.3 Tenant-scoped data-governance readout

settings 现在已经能读到 tenant-scoped 的治理姿态，而不是只剩零散动作：

- active auth sessions
- org-admin audit / 30d
- governance audit / 30d
- memory exports / 30d
- memory mutations / 30d
- soft-deleted memory entries
- invalid memory facts
- recent active auth sessions
- recent data-governance audit

当前这些 readout 都继续以 active workspace 为边界，不做跨租户聚合。

## 4. 已成形但仍需下一层

- capability matrix 已覆盖又一层高风险路径，但还没有覆盖所有 write path
- org-admin support pack 已成立，但还不是完整 export / retention / support governance center
- tenant-scoped governance readout 已成立，但还不是 storage-level tenant isolation
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

- capability matrix 仍需继续覆盖剩余 high-risk write path，避免 future drift
- org-admin support pack 仍是 tenant-scoped governance snapshot，不是完整 support tooling
- tenant isolation 仍主要依赖 application-layer workspace scoping，不应误写成完整 enterprise tenant isolation
- retention / delete governance 目前以 readout 和 guard 为主，还不是完整治理平台

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的第三层治理收紧
- Helm 已具备 broader capability coverage、tenant-scoped org-admin support pack，以及 retention / auth-session / export-delete posture readout
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant，也没有扩成 cross-tenant support tooling
- Helm 当前仍然不拥有 broader execution authority

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. broader capability coverage on remaining high-risk write path
2. org-admin audit / export / retention / support pack follow-through
3. tenant isolation / export / retention / delete governance
4. enterprise layer only under explicit demand
