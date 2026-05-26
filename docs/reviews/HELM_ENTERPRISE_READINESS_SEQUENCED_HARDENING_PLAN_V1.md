---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Enterprise Readiness Sequenced Hardening Plan V1

更新时间：2026-04-06
状态：Completed
范围：继续按既定顺序推进 1) auth/session continuation, 2) tenant data governance application-layer closure, 3) enterprise infra planning freeze；当前 PR 不做 Docker / Kubernetes / CI / SSO / SCIM rollout

## 1. 目的

把 Helm 当前“企业准备”这条线压成可实施的连续三段，而不是把应用治理、租户治理和基础设施平台化混成一轮大扩张。

本计划只回答五件事：

1. Phase 1 还剩哪些 auth/session continuation 缺口
2. Phase 2 还剩哪些 tenant data governance application-layer 缺口
3. Phase 3 的 enterprise infra 这轮应该冻结到哪一层
4. 哪些能力仍然必须继续诚实保留为未实现
5. 整体验证合同是什么

它不是：

- 直接开做 Docker / Kubernetes / Helm chart / CI implementation
- 直接开做 SSO / SAML / SCIM / MFA rollout
- 直接切 schema-per-tenant / db-per-tenant
- 直接开 full enterprise IAM / API Gateway / OAuth2 platform

## 2. 当前 freeze truth

### 2.1 Auth / session

当前已经成立：

- DB-backed `AuthSession`
- shared `session-governance` truth
- richer anomaly review next slice
- scoped revoke governance with `AUTH_SESSION_SCOPE_REVOKED`
- org-admin auth controls consistency continuation

truth source：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_SESSION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

### 2.2 Tenant governance

当前已经成立：

- `workspace-first / membership-backed` tenant boundary
- capability matrix 与 tenant ownership governance
- workspace data governance deeper slice
- export / delete / retention support-pack readout

truth source：

- `HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md`
- `HELM_MULTITENANCY_WORKSPACE_DATA_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

### 2.3 Deploy baseline contract

当前已经成立：

- deploy baseline contract docs-and-guard truth
- future enterprise identity prerequisites wording
- release / rollback / config / secret contract wording

truth source：

- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

### 2.4 明确未成立

当前没有证据支持这些能力已经成立：

- Docker / docker-compose
- Kubernetes / Helm chart
- `.github/workflows/*` CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM
- schema-per-tenant / db-per-tenant
- VPC / subnet / autoscaling plane

## 3. 关键判断

当前最合理的推进顺序仍然是：

1. 把 auth/session 再收紧一层
2. 把 tenant data governance application-layer 再收紧一层
3. 单独冻结 enterprise infra planning truth

而不是：

1. 直接做 SSO / SCIM
2. 直接做 Docker / Kubernetes / CI
3. 直接切 schema-per-tenant / db-per-tenant

原因：

- 当前仓库最强的真实基础在应用治理，不在基础设施平台
- 当前租户隔离仍主要依赖 application-layer workspace scoping
- 当前 deploy baseline contract 仍是 docs-and-guard truth，直接拉进 infra implementation 会制造虚假完成度

## 4. Phase 1：Auth / Session Continuation

目标：

- 继续收紧 richer anomaly review
- 继续收紧 broader revoke scope
- 继续收紧 org-admin auth-control consistency

本轮原则：

- 只做 auth/session governance continuation
- 不把 anomaly review 写成 MFA rollout
- 不把 provider seam 写成 SSO / SCIM implementation

交付：

- 代码改动
- 测试更新
- baseline / report 更新

## 5. Phase 2：Tenant Data Governance Application-layer Closure

目标：

- 把 current-main 里“已成形但仍需下一层”的 tenant governance 再推进一层
- 补 support-pack / settings governance 的更细 readout

本轮原则：

- 只做 application-layer closure
- 不把它写成 infra-level tenant isolation
- 不切 schema-per-tenant / db-per-tenant

交付：

- code / tests / docs / guards

## 6. Phase 3：Enterprise Infra Planning Freeze

目标：

- 把 enterprise infra / deploy follow-through 单独冻结成 roadmap truth
- 明确 prerequisites、ownership、defer list、validation contract

本轮原则：

- planning-only
- 不提交 Docker / Kubernetes / CI implementation
- 不把 SSO / SCIM rollout 写成已做

交付：

- baseline / report / plan
- README / docs index / guards 同步

## 7. 风险

1. 如果把 auth continuation 误写成 enterprise IAM，会破坏当前边界诚实性
2. 如果把 tenant governance application-layer closure 写成 storage-level isolation，会误导当前基线
3. 如果把 Phase 3 混成 infra implementation，会把 planning slice 误写成平台工程

## 8. 明确递延项

- Docker / docker-compose implementation
- Kubernetes manifests / Helm chart
- CI/CD implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant
- VPC / subnet / autoscaling implementation
- API Gateway / OAuth2 platform

## 9. 验证合同

实现阶段统一跑：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 10. 当前执行顺序

1. Phase 0 plan freeze
2. Phase 1 auth/session continuation
3. Phase 2 tenant data governance closure
4. Phase 3 enterprise infra planning freeze

## 11. 完成说明

本计划对应的交付物已经落库：

- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md`
- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_REPORT_V1.md`

当前 freeze truth 继续保留：

- `dataGovernanceClosure` 是 application-layer closure
- enterprise infra planning freeze remains planning-only truth
- Docker / Kubernetes / CI implementation remain intentionally not done
