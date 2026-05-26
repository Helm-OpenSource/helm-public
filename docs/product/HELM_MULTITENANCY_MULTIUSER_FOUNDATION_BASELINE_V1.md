---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy / Multiuser Foundation Baseline V1

## 1. 目的

冻结 Helm 当前主干的多租户 / 多用户基础真值。

本基线只回答四件事：

1. 当前 `workspace-first / membership-backed` 多租户边界已经成立到哪一层
2. 当前多用户协作和组织管理员能力已经成立到哪一层
3. 当前刻意不做什么
4. 哪些边界必须继续诚实保留

它不是：

- full RBAC builder
- SSO / SCIM / domain claim 完整方案
- enterprise org hierarchy
- shared billing / enterprise account 平台
- broader execution authority expansion

## 2. 当前基线

当前多租户 / 多用户 foundation 继续保持：

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
- `Membership` 是 user-to-organization seam
- `BillingAccount / TrialState / WorkerEntitlement / UsageLedger` 仍然是组织级商业 truth

## 3. 已经完整成立

### 3.1 Session / identity hardening

当前认证入口已经从“email cookie + workspace cookie”收紧到最小 DB-backed auth session substrate：

- 新增 `AuthSession` 作为登录 session 真值
- cookie 只再承担 opaque session handle，不再承担 user identity truth
- `activeWorkspaceId` 绑定到 `AuthSession`
- login / signup / participant portal onboarding 都走统一 session substrate
- logout 会 revoke 当前 auth session，而不是只删 cookie
- session 记录现在包含：
  - `userId`
  - `activeWorkspaceId`
  - `sourcePage`
  - `userAgent`
  - `ipAddress`
  - `expiresAt`
  - `revokedAt`

### 3.2 Centralized authorization matrix

当前高风险 settings / admin path 已经从 scattered role checks 收到集中 capability matrix：

- `workspace.manage_members`
- `workspace.manage_billing`
- `workspace.read_contribution_registry`
- `workspace.manage_contribution_registry`
- `workspace.manage_manual_settlement`
- `workspace.manage_participant_portal`

当前这层已经接入：

- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `lib/auth/participant-portal.ts`

这表示当前高风险组织管理面不再只靠分散的 `role === ...` 判断拼装。

### 3.3 Org admin / membership lifecycle first slice

当前组织管理员已经有一条最小但真实的成员生命周期路径：

- add member
- switch organization
- deactivate member
- reactivate member
- restore invite posture
- transfer ownership
- last-owner guard

当前 owner transfer 规则保持窄边界：

- 只有当前 owner 可以发起 ownership transfer
- target 必须是 `ACTIVE` 成员
- self-transfer 不允许
- transfer 后，原 owner 会降为 `ADMIN`

当前 member lifecycle 规则也保持窄边界：

- last active owner 不能被直接停用
- active 成员不能直接退回 invited
- invited 成员不会被管理员静默直接升成 active
- owner 不会被直接退回 invited

## 4. 已成形但仍需下一层

- session revocation / rotation 已成立，但还不是完整 production IAM / enterprise session management
- centralized authorization 已成立，但仍是 fixed-role capability matrix，不是 custom RBAC builder
- org admin lifecycle 已成立第一轮，但仍不是完整 org admin console
- current settings surface 已经能做关键成员修正，但还没有完整 domain policy / invite delivery / admin audit pack

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- SSO / SAML / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- parent-child tenant
- shared billing / enterprise account
- cross-tenant support tooling
- broader execution authority

## 6. 风险项

- 当前 auth session 仍然是 repo 内受控试点认证链，不是完整生产级 enterprise auth
- workspace-level isolation 仍主要靠 application-layer workspace scoping，不是 schema-per-tenant / database-per-tenant
- current capability matrix 仍需要继续覆盖更多 high-risk write path，避免 future drift
- invite delivery 仍然没有真实 mail / SMS rail，当前 invite 仍以 controlled entry path 为主

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已经具备 `workspace-first / membership-backed` 的多租户与多用户基础
- Helm 已经有受控的 DB-backed auth session、集中授权矩阵和第一轮组织成员生命周期
- Helm 仍不是完整企业级多组织 / 多权限 / 多租户平台
- Helm 当前也仍不是 full RBAC、不是 SSO / SCIM、不是 enterprise org hierarchy

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. auth / session further hardening
2. broader capability coverage on high-risk write path
3. richer org admin lifecycle and audit pack
4. tenant isolation / retention / export / support runbook
5. enterprise layer 只在真实需求下再评估
