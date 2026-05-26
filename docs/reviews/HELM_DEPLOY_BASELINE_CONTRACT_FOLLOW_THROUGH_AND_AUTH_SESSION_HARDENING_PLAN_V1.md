---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Deploy Baseline Contract Follow-through And Auth / Session Hardening Plan V1

更新时间：2026-04-06
状态：Phase 1 Completed；deploy baseline contract landed；auth/session continuation deferred
范围：deploy baseline contract follow-through 已落地；auth/session hardening continuation 保持下一层计划；不进入 Docker / Kubernetes / CI implementation

## 1. 当前 freeze truth

当前 PR63 基线继承：

- `../product/HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_PLAN_V1.md`
- `HELM_ENTERPRISE_READINESS_AUTH_DEPLOY_AND_TENANT_HARDENING_PLAN_V1.md`
- `../../lib/auth/session.ts`

当前已经成立：

- DB-backed `AuthSession`
- session create / rotate / revoke / workspace-switch lifecycle
- `providerType` seam，为未来 enterprise identity 预留接口
- org-admin 对 active sessions、auth anomaly、auth controls consistency 的第一轮 readout

当前明确未成立：

- Docker / docker-compose implementation
- Helm chart / Kubernetes manifests
- `.github/workflows/*` CI baseline
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM
- schema-per-tenant / db-per-tenant

仓库扫描结果：当前分支下没有 `Dockerfile`、`docker-compose.yml`、`Chart.yaml`、`.github/workflows/*`、`k8s/`、`kubernetes/`

## 2. 本轮要证明什么

PR63 分两层证明：

1. Phase 1 已证明 Helm 当前已经具备写出 `deploy baseline contract` 的真实前提，但不应把它写成 infra implementation 已成立
2. Phase 2 保持定义题：PR61 的 auth/session baseline 已经足够进入下一层 anomaly review 和 session governance refinement
3. 当前阶段应该先把 deploy contract 与 auth/session continuation 的边界写清楚，再决定是否进入容器化 / CI / infra

## 3. 精确闭环

`PR61 auth/session hardening baseline -> PR63 deploy baseline contract follow-through -> next auth/session continuation -> deferred infra platformization`

## 4. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / full RBAC
- 当前仍没有 Docker / Kubernetes / CI implementation

## 5. 阶段计划

### Phase 0

- clean worktree / branch
- 计划冻结
- docs discoverability 同步

### Phase 1

- 已完成：
- 定义 `deploy baseline contract follow-through` 的真实合同边界
- 明确：
  - environment matrix
  - config / secret contract
  - build / test / release / rollback contract
  - deploy readiness wording

### Phase 2

- 递延：
- 定义 auth/session continuation 的真实下一层
- 明确：
  - richer auth anomaly review
  - broader revoke scope
  - org-admin auth controls consistency
  - future enterprise identity seam follow-through

### Phase 3

- 已完成：
- baseline / report 骨架
- README / docs index 对齐
- guards discoverability 对齐
- draft PR

## 6. 验证合同

Phase 1 已执行标准验证链：

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
- Helm chart / Kubernetes manifests
- CI/CD pipeline implementation
- VPC / subnet / autoscaling plane
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant
