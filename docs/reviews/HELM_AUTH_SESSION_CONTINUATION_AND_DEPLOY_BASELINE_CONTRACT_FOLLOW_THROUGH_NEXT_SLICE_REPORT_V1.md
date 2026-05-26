---
status: archived
owner: helm-core
created: 2026-04-06
review_after: 2026-10-03
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Auth / Session Continuation And Deploy Baseline Contract Follow-through Next Slice Report V1

## 1. 结论

PR65 Phase 1 把 Helm 当前 main 的 auth/session continuation 从“已有 richer anomaly review 和 first-slice broader revoke scope”继续收紧到了“shared session-governance truth、next-slice anomaly review、next-slice revoke scope，以及更严的 org-admin auth controls consistency”。

当前这轮已经完整成立：

- `lib/auth/session-governance.ts`
- `MISSING_SOURCE_PAGE`
- `PROVIDER_SOURCE_MISMATCH`
- `WORKSPACE_MEMBERSHIP_MISMATCH`
- `/portal/access` participant-portal compatibility truth
- `activeWorkspaceId`-scoped membership mismatch truth
- deploy baseline contract docs/guard truth

当前这轮仍然刻意不做：

- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- Docker / Kubernetes / Helm chart / CI implementation
- full enterprise IAM
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared auth-session governance truth

- 新增 `lib/auth/session-governance.ts`
- 把 stale / expiring / source-page / provider-source / workspace-membership 判断统一为 shared helper
- session revoke scope filtering 与 org-admin summary 现在复用同一套 truth，不再各自漂移

### 2.2 Richer auth anomaly review next slice

- org-admin governance summary 继续收紧了：
  - `missingSourcePageSessionCount`
  - `providerSourceMismatchSessionCount`
  - `workspaceMembershipMismatchSessionCount`
- recent active auth sessions 现在继续使用 shared helper 派生 anomaly posture
- `/portal/access` 现在被视为 `PARTICIPANT_PORTAL` 的合法 source page，不再误报 source mismatch

### 2.3 Broader revoke scope next slice

- `revokeWorkspaceAuthSessionsByScope` 继续扩大到：
  - `MISSING_SOURCE_PAGE`
  - `PROVIDER_SOURCE_MISMATCH`
  - `WORKSPACE_MEMBERSHIP_MISMATCH`
- bulk revoke 仍然保持：
  - workspace-scoped
  - explicit operator control
  - current session protected
- 当前新增了 scope-level bulk revoke 审计：
  - `AUTH_SESSION_SCOPE_REVOKED`
  - `scopeRevokeActionCount30d`
  - `scopeRevokedSessionCount30d`
  - `revokeScopeSummary30d`
  - `latestScopedSessionRevokeAudit`

### 2.4 Org-admin auth controls consistency continuation

- settings auth controls 现在能显式执行上述三类新的 anomaly revoke
- org-admin / settings 现在对 workspace membership mismatch 的解释是“针对当前 active workspace”，不再是“用户是否还有任意 membership”
- support-pack export audit payload 现在也会带上 scoped revoke follow-through，方便 operator 回溯 bulk revoke 发生过什么

### 2.5 Deploy baseline contract follow-through

- deploy baseline contract 继续保持 current-main truth：
  - Next.js app
  - Prisma
  - env contract
  - npm validation chain
- `Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done`

## 3. 验证结果

本轮已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 4. 已成形但仍需下一层

- richer anomaly review 仍是 operator-facing review，不是安全监控平台
- broader revoke scope 仍只是 next-slice session governance，不是 full IAM console
- deploy baseline contract 已继续成立，但仍是 docs-and-guard truth，不是 infra implementation

## 5. 刻意未做

- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- enterprise org hierarchy
- Docker / Kubernetes / Helm chart / CI implementation
- API Gateway / OAuth2 platform
- execution-authority expansion

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

- `providerType = null` 的 legacy row 会继续存在一段迁移尾巴
- current auth-session anomaly review is operator-facing review truth, not full enterprise IAM
- tenant isolation 仍主要依赖 application-layer `workspace` scoping

下一阶段如继续推进，优先顺序应是：

1. auth anomaly follow-through richer review deeper slice
2. broader session governance / revoke scope refinement deeper slice
3. deploy baseline contract follow-through next slice
4. tenant data governance hardening
