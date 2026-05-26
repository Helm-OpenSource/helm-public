---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy / Multiuser Foundation Report V1

## 1. 结论

PR42 把 Helm 当前主干的多租户 / 多用户基础从“能跑”收紧到了“有统一 session truth、统一 capability truth、统一 membership lifecycle truth”的第一轮可冻结版本。

当前这轮已经完整成立：

- DB-backed auth session
- centralized capability matrix for high-risk settings / admin paths
- org admin membership lifecycle first slice

当前这轮仍然刻意不做：

- full RBAC
- SSO / SCIM
- enterprise org hierarchy
- shared billing / enterprise account
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Identity / session hardening

- 新增 `AuthSession` model 和 migration
- `lib/auth/session.ts` 现在以 DB session 为真值
- `createSession` / `clearSession` / `setActiveWorkspace` 都已接入 session record
- login / signup / participant portal onboarding 都改走新 session path
- logout 会 revoke session 并清 cookie

### 2.2 Centralized authorization

- 新增 `lib/auth/authorization.ts`
- 角色到 capability 的映射已集中化
- settings actions / settings queries / participant portal management 已接到集中 authz seam

### 2.3 Org admin lifecycle

- 新增 membership lifecycle guard
- 新增 ownership transfer guard
- settings 里已支持：
  - deactivate member
  - reactivate member
  - restore invite posture
  - transfer owner
- last active owner 保护已经落到后端 guard，而不是只靠 UI

## 3. 验证结果

本轮已通过：

- `npm run db:generate`
- `npm run test -- lib/auth/session.test.ts`
- `npm run test -- lib/auth/session.test.ts lib/auth/authorization.test.ts`
- `npm run test -- lib/auth/session.test.ts lib/auth/authorization.test.ts lib/auth/membership-lifecycle.test.ts`
- `npm run typecheck`

最终收口验证结果见本轮 closeout。

## 4. 已成形但仍需下一层

- auth session 仍然不是完整 enterprise auth / IAM
- centralized capability matrix 仍只覆盖第一批高风险 surface
- settings org admin surface 仍是 first slice，不是完整 admin console
- invite posture 已可恢复，但仍没有真实 mail / SMS delivery rail

## 5. 刻意未做

- full RBAC builder
- SSO / SAML / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
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

- session hardening 已成立，但 production-grade auth 仍需下一层
- capability matrix 还需要继续覆盖更多 write path
- org admin lifecycle 还缺更完整的 audit / domain / enterprise admin pack

下一阶段如继续推进，优先顺序应是：

1. auth / session further hardening
2. broader capability coverage
3. richer org admin lifecycle
4. tenant isolation / audit / support pack
5. enterprise layer deferred review
