---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Follow-through And Session Governance Deeper Slice Plan V1

更新时间：2026-04-06
状态：Completed

## 1. 当前 freeze truth

- DB-backed auth session 已成立
- `revokeWorkspaceAuthSessionsByScope()` 已成立
- richer auth anomaly review 已进入 org-admin / settings operator-facing readout
- current deploy baseline contract is docs-and-guard truth, not infrastructure platformization

## 2. 本轮目标

本轮只补三件事：

1. live revoke scope preview truth
2. current-session review-only scope truth
3. `entry-source truth` / `action-source truth` 与 org-admin / support-pack / settings readout、freeze docs 收口

## 3. 本轮范围

- `lib/auth/session.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/settings-client.tsx`
- `features/settings/queries.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- docs / guards / tests

## 4. 明确不做

- Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- full enterprise IAM
- execution authority expansion

## 5. 关键 truth

- `historical scoped revoke summary` 与 `live revoke preview` 必须明确分层
- `current session` 命中的 anomaly scope 只能进入 `review-only` truth，不进入 live revoke eligible count
- `entry-source truth` 与 `action-source truth` 必须继续显式保留
- auth-session anomaly review is operator-facing review truth, not full enterprise IAM
- deploy baseline contract 继续保持 docs-and-guard truth

## 6. 阶段

### Phase 0

- 复核当前 PR66 代码与窄测试状态

### Phase 1

- 增加 `buildAuthSessionRevokeScopePreview`
- 明确 `matchesAuthSessionRevokeScope`
- 扩 `liveRevokeScopeSummary`
- 扩 `currentSessionReviewScopeSummary`

### Phase 2

- 更新 baseline / report / plans / README / docs / self-check / boundary-check

### Phase 3

- 跑 targeted tests
- 跑完整验证链并收口

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
