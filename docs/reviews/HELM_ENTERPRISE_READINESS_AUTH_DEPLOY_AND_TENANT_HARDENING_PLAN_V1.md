---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Enterprise Readiness Auth / Deploy / Tenant Hardening Plan V1

更新时间：2026-04-06
状态：Planned
范围：planning only

## 1. 目的

把下一阶段的企业化诉求压成 Helm 当前可承接的实施顺序。

本计划只回答四件事：

1. 当前 `main` 已经具备哪些多租户 / 多用户 / tenant governance 基础
2. 你提出的 `SSO / MFA / SCIM / Docker / Kubernetes / db-per-tenant / API Gateway` 里，哪些现在可以推进，哪些必须递延
3. 下一轮应该先做哪条实现线
4. 如何在不破坏当前边界的前提下进入企业化准备阶段

它不是：

- 立即开做完整 enterprise IAM
- 立即开做完整 Kubernetes / VPC / autoscaling 平台
- 立即切 schema-per-tenant / db-per-tenant
- 立即引入 full API gateway / OAuth2 platform

## 2. current-main truth

### 2.1 已经成立

根据 current-main 代码和 freeze 文档，当前已经成立：

- `workspace-first / membership-backed` 多租户边界
- DB-backed auth session substrate
- fixed-role capability matrix
- tenant ownership governance
- org-admin lifecycle first slice
- export / retention / delete / support-pack 治理 readout
- webhook callback tenant mapping / anomaly follow-through first slice

truth source：

- `../product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `../product/HELM_MULTITENANCY_REMAINING_SERVICE_GOVERNANCE_AND_WEBHOOK_CALLBACK_ANOMALY_BASELINE_V1.md`
- `../../lib/auth/session.ts`

### 2.2 明确未成立

current-main 没有证据支持这些能力已经成立：

- SSO / SAML / SCIM / domain claim
- MFA policy integration
- enterprise IAM
- schema-per-tenant / db-per-tenant
- Dockerfile / docker-compose / Helm Chart / Kubernetes manifests
- repo 内 `.github/workflows/*` CI baseline
- API Gateway
- OAuth2 platform layer
- VPC / subnet-per-tenant / infra autoscaling plane
- GDPR / 中国数据驻留执行层

仓库证据：

- `../product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `../../README.md`
- 仓库扫描结果：当前仓库没有 `Dockerfile`、`docker-compose.yml`、`Chart.yaml`、`.github/workflows/*`、`k8s/`、`kubernetes/`

## 3. 关键判断

你提出的三大阶段方向本身没有问题，但对 Helm 当前仓库来说，顺序不对、跨度过大。

当前正确顺序不是：

`SSO / MFA / SCIM -> Docker / K8s -> db-per-tenant -> API Gateway`

当前更合理的顺序是：

`auth/session hardening completion -> deploy baseline contract -> tenant data governance hardening -> enterprise integration seams -> infra platformization if truly needed`

原因：

1. 当前最强的真实基础在应用层治理，不在基础设施平台
2. 当前仓库没有现成容器化 / K8s / CI baseline，直接跳过去会先变成补平台脚手架
3. 当前租户隔离仍主要依赖 application-layer `workspace` scoping，先补治理比先改数据库拓扑更稳
4. 当前文档明确把 `SSO / SCIM / schema-per-tenant / db-per-tenant` 作为未实现 / 刻意未做边界

## 4. 实施计划

### Phase 0: Environment Hygiene And Program Freeze

目标：

- 不在当前脏根仓库直接推进大范围变更
- 固定后续企业化工作必须在干净 worktree 上做
- 先冻结 current-main truth 和 defer list

交付：

- clean worktree
- 本计划文档
- `PLANS.md` 更新

### Phase 1: Auth / Session Hardening Completion

目标：

- 把当前“受控试点认证链”继续收紧成更稳的 production-facing controlled auth
- 先完成 auth/session correctness，再谈 enterprise identity integration

范围：

- session rotation / revoke / audit completeness
- stronger session anomaly review
- auth provider seam，为未来 SSO / MFA 预留接口
- invite / membership activation / organization switching correctness

刻意不做：

- 直接接 Okta / Google Identity Platform
- 直接上 SCIM
- 直接把 MFA 写成已经成立

### Phase 2: Deploy Baseline Contract

目标：

- 先定义 Helm 的 deploy baseline contract，而不是直接开做 Kubernetes

范围：

- environment matrix
- secrets / config boundary
- build / test / release / rollback contract
- CI contract 文档
- containerization only if current runtime target truly needs it

刻意不做：

- Kubernetes cluster rollout
- VPC-per-tenant
- autoscaling plane
- Helm chart release pipeline

### Phase 3: Tenant Data Governance Hardening

目标：

- 在当前 `workspace-first` 模型下，把 export / retention / delete / audit 做到更可信

范围：

- tenant-scoped export / delete / retention contract
- audit completeness
- support-pack / operator readout
- encryption / key-handling assumptions 文档化
- compliance seam for data residency / region policy

刻意不做：

- schema-per-tenant
- db-per-tenant
- cross-region live failover platform

### Phase 4: Enterprise Integration Seams

目标：

- 只做 seam，不直接写成完整 enterprise feature

范围：

- SSO / SAML / SCIM / MFA 的 seam design
- API auth boundary review
- compliance / region mapping review
- data residency policy model

刻意不做：

- 完整 Okta / Google Identity Platform rollout
- 完整 SCIM provisioning
- 完整 API Gateway 落地

### Phase 5: Infrastructure Platformization

只有在前四阶段完成并且真实业务需求成立时，才进入：

- Docker image standardization
- Kubernetes / Helm charts
- VPC / subnet isolation
- autoscaling
- schema-per-tenant / db-per-tenant evaluation

这一层默认递延，不作为当前立即开发目标。

## 5. 影响面

如果后续按本计划推进，首轮真正会碰到的组件是：

- `../../lib/auth/session.ts`
- `../../lib/auth/authorization.ts`
- `../../features/auth/actions.ts`
- `../../features/settings/actions.ts`
- `../../features/settings/queries.ts`
- `../../lib/auth/org-admin-governance.ts`
- `../../lib/billing/*`
- `../../app/api/billing/*`
- `../../app/api/settings/org-admin/support-pack/route.ts`

如果进入更后层才会碰：

- Docker / K8s / Helm Chart
- CI/CD workflow
- infra network topology
- tenant-specific database topology

## 6. 风险

1. 直接推进 SSO / SCIM / db-per-tenant，会让当前仓库从应用治理线跳成平台工程
2. 当前根仓库不是干净工作区；如果不切 clean worktree，极易混入无关改动
3. 当前仓库没有部署基础设施模板；直接承诺 Docker / Kubernetes 交付会先变成补基础设施脚手架
4. 当前租户隔离仍主要靠 application-layer `workspace` scoping；在没有更深治理收口前改数据库拓扑，回归面过大

## 7. 明确递延项

当前必须明确递延：

- SSO / SAML / SCIM implementation
- MFA rollout
- Google Identity Platform / Okta integration
- Docker / Kubernetes / Helm chart release pipeline
- VPC / subnet-per-tenant
- autoscaling plane
- schema-per-tenant / db-per-tenant
- API Gateway
- OAuth2 platform
- GDPR / 中国数据驻留执行平台

这些项可以保留在 roadmap / enterprise readiness backlog，但不应作为当前立即开发任务。

## 8. 验证合同

本轮是 planning-only，验证要求是：

- 计划与 current-main truth 一致
- 计划没有把未实现能力写成已实现
- defer list 明确
- 后续实现顺序明确

后续任何实现 PR 继续使用标准验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 下一步建议

下一步不应该直接开做 “SSO / K8s / SCIM / db-per-tenant”。

正确的下一条实现线应是一个更窄的 PR：

`Auth / Session Hardening Completion`

只做：

- session rotation / revoke / audit completion
- auth anomaly review
- auth provider seam for future enterprise identity
- org-admin auth controls consistency

这条线完成后，再评估 deploy baseline contract。
