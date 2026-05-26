---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Hardening Completion Plan V1

更新时间：2026-04-06
状态：Completed
范围：当前 main 的 DB-backed auth session 第一轮收口；不进入 SSO / SCIM / MFA rollout / full RBAC

## 1. 当前 freeze truth

当前 current-main 已成立：

- `AuthSession` 是登录 session 真值
- session cookie 只保存 opaque handle
- login / logout / workspace switch 已有基本 audit truth
- org-admin support-pack 已能显示 active auth sessions、latest auth-session audit 和 tenant-scoped governance posture

当前 current-main 仍未成立：

- `AUTH_SESSION_ROTATED` 的显式 truth
- future enterprise identity 的 provider seam
- 第一轮 auth anomaly review truth
- org-admin 对 auth control 的一致性管理动作

## 2. 本轮要证明什么

PR61 只证明：

1. Helm 当前 auth/session substrate 已经具备可解释的 rotation / revoke / audit 生命周期
2. current-main 已经有最小 future enterprise identity provider seam，但没有把 SSO / SCIM 误写成已实现
3. org-admin 现在不仅能看到 auth-session posture，也能对 tenant-scoped auth controls 做第一轮一致性管理
4. auth anomaly review 已形成 review-first readout，而不是被夸大成完整企业安全平台

## 3. 精确闭环

本轮 auth/session 闭环：

1. login / portal onboarding 通过 provider seam 创建 `AuthSession`
2. session nearing expiry 时显式 rotate，并留下 audit truth
3. logout 或 org-admin auth control 能 revoke tenant-scoped session
4. org-admin support-pack / settings 能显示 active sessions、latest auth audit、auth anomaly summary、control posture

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / full RBAC

## 5. 阶段计划

### Phase 0

- 计划冻结

### Phase 1

- auth provider seam
- explicit session rotation truth
- revoke helper completion

### Phase 2

- org-admin auth controls consistency
- auth anomaly summary
- settings / support-pack readout

### Phase 3

- tests / docs / guards / baseline / report
- full validation chain

## 6. 验证合同

必须通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 刻意递延

- SSO / SAML / SCIM / domain claim
- MFA rollout
- full RBAC
- enterprise org hierarchy
- deploy / infra baseline contract
- Docker / Kubernetes / CI/CD platformization
