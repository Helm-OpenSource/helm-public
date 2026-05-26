---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Continuation And Deploy Baseline Contract Follow-through Next Slice Plan V1

更新时间：2026-04-06
阶段：Completed
状态：Completed

## 1. 当前 freeze truth

本轮继承以下 current-main truth：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_BASELINE_V1.md`

当前已经成立：

- DB-backed `AuthSession`
- `providerType` seam
- explicit session create / rotate / revoke / workspace-switch lifecycle
- first-slice auth anomaly review
- first-slice broader revoke scope
- first-slice org-admin auth control consistency readout
- deploy baseline contract 的 environment / config / release / rollback wording

当前仍未成立：

- Docker / Kubernetes / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM

## 2. PR65 要证明什么

PR65 证明：

1. auth/session continuation 还能继续收紧，而不是在 PR64 后停止
2. org-admin 对 auth control posture 的解释和动作可以继续完善
3. deploy baseline contract 可以继续补 deployment-facing truth，但仍然只是 contract，不是 infra implementation

## 3. 精确闭环

`auth/session hardening baseline -> richer auth/session continuation -> deploy baseline contract follow-through next slice -> deferred infra/platform implementation`

## 4. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / Kubernetes platform

## 5. 本轮范围

- `lib/auth/session.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- `docs/product/HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `docs/product/HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_BASELINE_V1.md`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 6. 本轮不做

- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- API Gateway / OAuth2 platform
- schema-per-tenant / db-per-tenant

## 7. 阶段计划

### Phase 0

- clean worktree / branch
- plan freeze
- docs index sync

### Phase 1

- richer auth anomaly follow-through
- broader revoke scope next slice
- org-admin auth controls consistency continuation

### Phase 2

- deploy baseline contract follow-through next slice
- deployment prerequisites / config ownership / release-rollback wording

### Phase 3

- baseline / report
- README / docs index / self-check / boundary-check
- 完整验证链

## 8. 风险

1. 把 anomaly review 写成 MFA rollout truth
2. 把 revoke scope 做成高风险 bulk revoke
3. 把 deploy contract 写成 infra implementation 已完成
4. 只补 org-admin 动作，不补 operator-visible explanation

## 9. 验证合同

计划阶段最小验证：

- `npm run self-check`
- `npm run check:boundaries`

实现阶段完整验证：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
