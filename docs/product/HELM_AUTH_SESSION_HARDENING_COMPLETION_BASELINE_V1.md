---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Hardening Completion Baseline V1

## 1. 目的

冻结 Helm 当前 main 的 auth / session hardening completion truth。

本基线只回答四件事：

1. 当前 DB-backed auth session 已经收紧到哪一层
2. 当前 `providerType` seam、`AUTH_SESSION_ROTATED` truth 和 revoke / rotate control 已经成立到哪一层
3. 当前 org-admin auth anomaly review 和 auth controls consistency 已经成立到哪一层
4. 哪些 enterprise identity 能力仍然刻意未做

它不是：

- full enterprise IAM
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
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

当前 auth/session 真值仍然是：

- `AuthSession` 是登录 session 真值
- cookie 只承担 opaque session handle，不承担身份真值
- `activeWorkspaceId` 仍绑定到 `AuthSession`
- `providerType` 是 future enterprise identity provider seam，不是 SSO / SCIM implementation

## 3. 已经完整成立

### 3.1 Explicit session lifecycle truth

当前 auth/session 已经具备可解释的 lifecycle truth：

- `AUTH_SESSION_CREATED`
- `AUTH_SESSION_ROTATED`
- `AUTH_SESSION_REVOKED`
- `AUTH_SESSION_WORKSPACE_SWITCHED`

当前 `rotateCurrentAuthSession` 已经成立，并且 `rotateCurrentOrganizationAuthSessionAction` 把当前会话轮换收成显式控制。

当前 session rotation 是 explicit control，不是 an automatic server-component side effect。

### 3.2 Provider seam for future enterprise identity

当前 `providerType` 已经贯通到真实 session substrate：

- `EMAIL_ENTRY`
- `PASSWORD`
- `PHONE_CODE`
- `VERIFIED_SIGNUP`
- `PARTICIPANT_PORTAL`

这表示当前 main 已经能诚实表达“未来 enterprise identity provider seam 已预留”，但仍不能把它写成 SSO / SCIM 已实现。

### 3.3 Org-admin auth control consistency

当前 org-admin governance 已经能同时看到并管理 auth/session posture：

- recent active auth sessions
- revoke other session
- rotate current session
- `expiringSoonSessionCount`
- `staleActiveSessionCount`
- `legacyProviderSessionCount`
- `rotatedSessionCount30d`

当前 `legacy-provider sessions` 仍只是 operator-facing anomaly review truth，不是 enterprise IAM truth。

## 4. 已成形但仍需下一层

- auth/session 现在比 PR42 foundation 更完整，但仍不是 full enterprise IAM
- `providerType` seam 已成立，但仍不是 SSO / SCIM / domain claim
- anomaly review 已成立，但仍不是完整安全监控平台
- org-admin auth controls consistency 已成立第一轮，但仍不是完整 security admin center

## 5. 刻意未做

本轮刻意未做：

- SSO / SAML / SCIM
- MFA rollout
- domain claim / JIT
- full RBAC
- enterprise org hierarchy
- deploy / infra platformization
- execution-authority expansion

## 6. 风险项

- current auth session 仍是 repo 内受控试点 auth substrate，不是完整生产级 enterprise auth
- tenant isolation 仍主要依赖 application-layer `workspace` scoping
- auth anomaly readout 依赖 current operator surface，不是独立安全平台
- old session records 允许 `providerType = null`，因此 `legacyProviderSessionCount` 会长期存在一段迁移尾巴

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已经具备 DB-backed auth session 的 explicit create / rotate / revoke / workspace-switch lifecycle truth
- Helm 已经有最小 `providerType` seam，可承接未来 enterprise identity integration
- Helm 已经能在 org-admin support-pack / settings 中显示 auth anomaly review 和第一轮 auth controls consistency
- Helm 仍不是 full enterprise IAM，也不是 SSO / SCIM / full RBAC

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. auth anomaly follow-through richer review
2. broader session governance / revoke scope refinement
3. deploy baseline contract
4. tenant data governance hardening
5. enterprise integration seams 只在真实需求下再评估
