---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Continuation And Deploy Baseline Contract Follow-through Baseline V1

## 1. 目的

冻结 PR64 Phase 1 的 current-main truth：

1. 当前 auth/session richer anomaly review 已继续成立到哪一层
2. 当前 broader revoke scope 与 org-admin auth controls consistency 已成立到哪一层
3. 当前 deploy baseline contract 应如何继续诚实表达

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

### 3.1 Richer auth anomaly review

当前 org-admin governance / settings 已经能显示：

- `expiringSoonSessionCount`
- `staleActiveSessionCount`
- `legacyProviderSessionCount`
- `missingSourcePageSessionCount`
- `providerSourceMismatchSessionCount`
- `workspaceMembershipMismatchSessionCount`
- `rotatedSessionCount30d`

当前 recent active auth session row 已经能显示：

- `isExpiringSoon`
- `isStale`
- `isLegacyProvider`
- `isMissingSourcePage`
- `hasProviderSourceMismatch`
- `hasWorkspaceMembershipMismatch`

`auth-session anomaly review is operator-facing review truth, not full enterprise IAM`.

### 3.2 Broader revoke scope governance

当前 `revokeWorkspaceAuthSessionsByScope` 已成立，并支持：

- `STALE_ACTIVE`
- `LEGACY_PROVIDER`
- `OTHER_ACTIVE`

这些 revoke scope 继续保持：

- 只在当前 workspace 内执行
- 不把 current session 误伤成 bulk revoke 目标
- 继续走显式 operator control，不做自动 server-side revoke

### 3.3 Org-admin auth controls consistency

当前 settings / org-admin 已经能把 richer anomaly posture 和 broader revoke scope 放到同一条 auth control truth 里，能诚实解释：

- 哪些 session 缺少 `sourcePage`
- 哪些 session 出现 `provider/source mismatch`
- 哪些 session 与当前 workspace membership posture 不一致
- 哪些 session 属于 stale / legacy / other-active bulk revoke 范围

## 4. 已成形但仍需下一层

- current auth anomaly review 已成立 richer operator layer，但仍不是完整 security monitoring platform
- broader revoke scope refinement 已成立，但仍不是 full session governance center
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

- Helm 已经具备 richer auth-session anomaly review
- Helm 已经具备 workspace-scoped broader revoke scope governance
- Helm 已经具备 deploy baseline contract 的 docs/guard truth
- Helm 仍不是 full enterprise IAM，也还没有 Docker / Kubernetes / Helm chart / deploy pipeline implementation
