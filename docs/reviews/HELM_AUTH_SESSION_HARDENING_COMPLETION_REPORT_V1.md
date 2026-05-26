---
status: archived
owner: helm-core
created: 2026-04-06
review_after: 2026-10-03
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Auth / Session Hardening Completion Report V1

## 1. 结论

PR61 把 Helm 当前 main 的 auth/session substrate 从“已有 DB-backed session foundation”收紧到了“有 explicit rotate / revoke / audit truth、有 future enterprise provider seam、并有 org-admin auth anomaly review”的第一轮可冻结版本。

当前这轮已经完整成立：

- `providerType` seam
- `AUTH_SESSION_ROTATED` truth
- `rotateCurrentAuthSession`
- `rotateCurrentOrganizationAuthSessionAction`
- org-admin auth anomaly readout

当前这轮仍然刻意不做：

- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- enterprise IAM platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Auth session lifecycle completion

- `AuthSession` 新增 `providerType`
- login / signup / participant portal onboarding 都会把 `providerType` 写入 session truth
- session create / revoke audit payload 现在带 `providerType`
- 新增 `AUTH_SESSION_ROTATED`
- 当前 session rotation 改成 explicit control；current session rotation is explicit control, not an automatic server-component side effect

### 2.2 Org-admin auth control consistency

- settings 里现在能 revoke 其他 tenant-scoped auth session
- settings 里现在能 rotate 当前 session
- org-admin governance summary 现在能显示：
  - `expiringSoonSessionCount`
  - `staleActiveSessionCount`
  - `legacyProviderSessionCount`
  - `rotatedSessionCount30d`
- recent active auth sessions 现在会显示 provider、expiring soon、stale、legacy-provider posture

### 2.3 Freeze / docs / guards

- 新增 baseline / report
- 同步 `README.md`
- 同步 `docs/README.md`
- 同步 `scripts/helm-self-check.ts`
- 同步 `scripts/decision-first-boundary-check.ts`

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

- auth anomaly review 仍是 operator-facing review，不是完整安全监控平台
- current provider seam 仍只是 future enterprise identity seam，不是 SSO / SCIM implementation
- current auth controls consistency 仍只是第一轮 settings/org-admin control，不是完整 IAM console

## 5. 刻意未做

- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- domain claim / JIT
- enterprise org hierarchy
- deploy / infra baseline
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

- current auth session 仍不是 full enterprise IAM
- old rows 的 `providerType = null` 会继续出现在 anomaly review 里
- tenant isolation 仍主要依赖 application-layer `workspace` scoping

下一阶段如继续推进，优先顺序应是：

1. auth anomaly follow-through richer review
2. broader session governance / revoke scope refinement
3. deploy baseline contract
4. tenant data governance hardening
5. enterprise integration seams deferred review
