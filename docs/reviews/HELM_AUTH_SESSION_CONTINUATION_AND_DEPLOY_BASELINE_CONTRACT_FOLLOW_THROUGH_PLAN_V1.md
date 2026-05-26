---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth / Session Continuation And Deploy Baseline Contract Follow-through Plan V1

更新时间：2026-04-06
状态：Phase 1 Completed；Phase 2 deferred
范围：继续收 auth/session anomaly review 与 revoke governance，并把 deploy baseline contract 从“已定义”推进到更明确的 follow-through contract；不进入 Docker / Kubernetes / CI implementation

## 1. 当前 freeze truth

当前 PR64 基线继承：

- `../product/HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `../product/HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_AND_AUTH_SESSION_HARDENING_REPORT_V1.md`
- `../../lib/auth/session.ts`

当前已经成立：

- DB-backed `AuthSession`
- `create / rotate / revoke / workspace-switch` session lifecycle
- `providerType` seam，为 future enterprise identity 预留接口
- org-admin 对 active sessions、expiring / stale / legacy / rotated posture 的第一轮 anomaly readout
- deploy baseline contract 已冻结当前 environment matrix、config / secret contract、build / test / release / rollback wording

当前明确未成立：

- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM
- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- schema-per-tenant / db-per-tenant

## 2. 本轮要证明什么

PR64 只证明两件事：

1. PR61 的 auth/session substrate 可以继续进入下一层 anomaly review 与 scoped revoke governance，而不需要跳到 SSO / SCIM
2. PR63 的 deploy baseline contract 可以继续补 deployment-facing follow-through truth，而不把它写成 infra implementation 已成立

## 3. 精确闭环

`PR61 auth/session baseline -> PR63 deploy baseline contract -> PR64 anomaly/revoke/deploy follow-through -> deferred infra/platform implementation`

## 4. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / MFA / Kubernetes platform

## 5. 阶段计划

### Phase 0

- clean worktree / branch
- 计划冻结
- docs discoverability 同步

### Phase 1

- 收 auth anomaly review richer readout
- 收 broader revoke scope 与 session governance follow-through
- 保持 session truth 与 org-admin auth controls consistency
- 已完成

### Phase 2

- 补 deploy baseline contract follow-through
- 明确 deploy contract 的：
  - environment prerequisites
  - secret / config ownership
  - release / rollback / verification contract
  - future enterprise identity prerequisites

### Phase 3

- baseline / report
- README / docs index / self-check / boundary-check
- 完整验证链

## 6. 验证合同

实现阶段默认执行完整验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式递延项

- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- API Gateway / OAuth2 platform
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant
