---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Continuation And Deploy Baseline Contract Follow-through Next Slice Baseline V1

## 1. 目的

冻结 PR65 这一层 current-main truth：

1. richer auth anomaly review 已继续收紧到哪一层
2. broader revoke scope 已继续收紧到哪一层
3. org-admin auth controls consistency 已继续收紧到哪一层
4. deploy baseline contract 继续成立到哪一层

它不是：

- full enterprise IAM
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- Docker / Kubernetes / Helm chart / deploy pipeline implementation
- execution-authority expansion

## 2. 当前基线

当前 auth/session 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

当前真值仍然是：

- `AuthSession` 是 DB-backed session truth
- cookie 只承担 opaque session handle，不承担身份真值
- `activeWorkspaceId` 仍绑定到 `AuthSession`
- `providerType` 是 future enterprise identity seam，不是 SSO / SCIM implementation

## 3. 已经完整成立

### 3.1 Shared auth-session governance truth

当前已经新增并统一到：

- `lib/auth/session-governance.ts`

这层 shared helper 已经收成同一套 truth：

- `isAuthSessionExpiringSoon`
- `isAuthSessionStale`
- `hasAuthSessionMissingSourcePage`
- `hasAuthSessionProviderSourceMismatch`
- `hasAuthSessionWorkspaceMembershipMismatch`

它现在同时服务于：

- session revoke scope filtering
- org-admin governance summary
- settings operator readout

### 3.2 Richer auth anomaly review next slice

当前 org-admin governance / settings 已经能稳定显示：

- `expiringSoonSessionCount`
- `staleActiveSessionCount`
- `legacyProviderSessionCount`
- `missingSourcePageSessionCount`
- `providerSourceMismatchSessionCount`
- `workspaceMembershipMismatchSessionCount`
- `rotatedSessionCount30d`

当前 recent active auth session row 已经能稳定显示：

- `isExpiringSoon`
- `isStale`
- `isLegacyProvider`
- `isMissingSourcePage`
- `hasProviderSourceMismatch`
- `hasWorkspaceMembershipMismatch`

其中当前 next-slice 继续收紧了两条判断：

- `/portal/access` 现在被明确视为 `PARTICIPANT_PORTAL` 的有效 source page
- `workspaceMembershipMismatch` 现在按 session 的 `activeWorkspaceId` 校验，而不是只做“用户是否还有任意 active membership”的粗判断

`auth-session anomaly review is operator-facing review truth, not full enterprise IAM`.

### 3.3 Broader revoke scope next slice

当前 `revokeWorkspaceAuthSessionsByScope` 已继续收紧，并支持：

- `STALE_ACTIVE`
- `LEGACY_PROVIDER`
- `MISSING_SOURCE_PAGE`
- `PROVIDER_SOURCE_MISMATCH`
- `WORKSPACE_MEMBERSHIP_MISMATCH`
- `OTHER_ACTIVE`

这些 revoke scope 继续保持：

- 只在当前 workspace 内执行
- 不把 current session 误伤成 bulk revoke 目标
- 继续走显式 operator control，不做自动 server-side revoke

当前这一层还新增了明确的 scope-level bulk revoke truth：

- `AUTH_SESSION_SCOPE_REVOKED`
- `scopeRevokeActionCount30d`
- `scopeRevokedSessionCount30d`
- `revokeScopeSummary30d`
- `latestScopedSessionRevokeAudit`

这意味着 bulk revoke 不再只表现为逐条 `AUTH_SESSION_REVOKED`，而是会留下可解释的 scope-level follow-through 审计。

### 3.4 Org-admin auth controls consistency continuation

当前 settings / org-admin 已经能把 richer anomaly posture 和 broader revoke scope 放到同一条 auth control truth 里，能诚实解释：

- 哪些 session 缺少 `sourcePage`
- 哪些 session 出现 `provider/source mismatch`
- 哪些 session 与当前 `activeWorkspaceId` 的 membership posture 不一致
- 哪些 session 属于 stale / legacy / other-active bulk revoke 范围
- 哪些 anomaly scope 现在可以被显式 bulk revoke
- 最近一次 scoped bulk revoke 是什么 scope、撤销了多少 session

## 4. 已成形但仍需下一层

- current auth anomaly review 已成立 richer operator layer，但仍不是完整 security monitoring platform
- broader revoke scope refinement 已成立 next slice，但仍不是 full session governance center
- current deploy baseline contract 已能冻结 truth，但仍不是 infra implementation

## 5. 刻意未做

本轮刻意未做：

- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- enterprise org hierarchy
- Docker / Kubernetes / Helm chart / CI implementation
- API Gateway / OAuth2 platform
- execution-authority expansion

## 6. 风险项

- 历史 `AuthSession` 行允许 `providerType = null`，因此 `legacyProviderSessionCount` 会保留一段迁移尾巴
- current anomaly review 依赖 current operator surface，不是独立安全平台
- tenant isolation 仍主要依赖 application-layer `workspace` scoping

## 7. Deploy Baseline Contract Truth

当前 deploy baseline contract 继续保持诚实表达：

- `current deploy baseline contract is docs-and-guard truth, not infrastructure platformization`
- 当前真实运行基线是 `Next.js app + Prisma + env contract + npm validation chain`
- 当前已有 repo-level validation workflow，但 `Docker / Kubernetes / Helm chart / deploy pipeline implementation remain intentionally not done`

## 8. 对外诚实口径

当前可以诚实表述为：

- Helm 已经具备 richer auth-session anomaly review next slice
- Helm 已经具备 workspace-scoped broader revoke scope next slice
- Helm 已经具备 org-admin auth control consistency continuation
- Helm 仍不是 full enterprise IAM，也还没有 Docker / Kubernetes / Helm chart / deploy pipeline implementation
