---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Deploy Baseline Contract V1

## 1. 目的

冻结 Helm 当前 main 的 deploy baseline contract truth。

本基线只回答六件事：

1. 当前仓库已经成立到哪一层 deployment baseline
2. 当前 environment matrix、config / secret contract 的真实边界是什么
3. 当前 build / test / release / rollback contract 到哪一层
4. 当前 auth/session baseline 如何作为未来 enterprise identity 的前置条件
5. 哪些 infra / enterprise identity 能力仍然刻意未做
6. 哪些 customer-facing wording 现在可以诚实写，哪些不能写

它不是：

- Docker implementation
- docker-compose implementation
- Helm chart / Kubernetes manifests
- CI/CD deploy pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM
- schema-per-tenant / db-per-tenant

## 2. 当前基线

当前 deploy baseline 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

当前 deploy baseline 真值是：

- 应用运行时是 Next.js app，当前标准入口是 `npm run dev`、`npm run build`、`npm run start`
- 当前数据库 contract 是 Prisma + `DATABASE_URL`
- 当前仓库默认 datasource provider 是 `mysql`
- 当前 `.env.example` 明确列出 `APP_URL`、connector / payment rail / LLM / ASR 所需 env contract
- 当前 auth/session 基线继承 `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- 当前 deploy baseline contract 只证明“受控部署所需的真实前提已明确”，不证明 infra implementation 已成立

## 3. Environment Matrix

### 3.1 Local / controlled development

当前仓库默认开发环境是：

- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4"`
- `APP_URL="http://localhost:3000"`
- `npm run dev`

这表示当前 main 已经能诚实承接本地与受控试点环境，但不能把它写成 production platform baseline。

### 3.2 Controlled-trial deploy baseline

当前受控部署基线是：

- 先跑标准验证链
- 生成 `next build` 产物
- 通过 `next start` 运行产物
- 使用 env 注入 secrets / config

当前可以诚实表达为：

- Helm 已经具备 controlled-trial deploy baseline contract
- Helm 已经有 repo-level validation workflow
- Helm 还没有 Docker / Kubernetes / deploy pipeline implementation

### 3.3 Future enterprise integration dependency

当前 future enterprise identity 的前置条件已经成立到：

- DB-backed `AuthSession`
- explicit create / rotate / revoke / workspace-switch lifecycle
- `providerType` seam

这表示 deploy contract 现在可以诚实说明“未来 enterprise identity integration 的应用侧前置条件已存在”，但仍不能写成：

- SSO 已实现
- SCIM 已实现
- full enterprise IAM 已实现

## 4. Config / Secret Contract

当前 deploy contract 明确依赖以下 env / config seam：

- `DATABASE_URL`
- `APP_URL`
- connector OAuth credentials
- payment rail credentials
- `OPENAI_API_KEY`
- ASR env contract

当前 secrets contract 真值是：

- secrets 通过 env 注入
- 当前仓库不提供 secret manager implementation
- 当前仓库不提供 infra-level key rotation plane
- 缺失某条 provider env 时，对应 provider capability 不应被写成“已 ready”

## 5. Build / Test / Release / Rollback Contract

当前 build / test / release / rollback contract 真值是：

- build contract：`npm run build`
- test contract：仓库标准验证链
- release contract：当前以 git revision + validated build artifact 为准
- rollback contract：当前是前一 git revision / 前一 build artifact 的受控回退，不是自动化 rollback plane

当前可以诚实写成：

- Helm 已经有明确的 build / test / release / rollback contract wording
- Helm 已经有 repo-level validation workflow
- Helm 还没有 CI/CD deploy pipeline implementation
- Helm 还没有 automated rollback orchestration

当前必须继续保留的边界：

- `npm run db:reset` 是开发 / 测试重建，不是 production rollback 机制
- 当前仓库没有 image build / push contract
- 当前仓库没有 chart release contract

## 6. 已经完整成立

- deploy baseline contract 的文档真值已经成立
- environment matrix 已经和 `package.json`、`.env.example`、`prisma/schema.prisma` 对齐
- auth/session baseline 已经能作为 future enterprise identity seam 的应用侧前置条件
- README / docs index / self-check / boundary-check 已经能发现并守住这层 contract truth

## 7. 已成形但仍需下一层

- deploy readiness wording 已成立，但 infra implementation 仍未开始
- auth/session continuation 仍需要下一层 anomaly review / revoke scope refinement
- secret contract 已清楚，但 secret management runtime 仍未成立
- release / rollback wording 已清楚，但 deploy automation 仍未成立

## 8. 刻意未做

本轮刻意未做：

- Docker / docker-compose implementation
- Helm chart / Kubernetes manifests
- deploy / release automation pipeline
- API Gateway / OAuth2 platform
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

## 9. 风险项

- 当前 deploy baseline 仍是 Next.js + Prisma + mysql 的受控试点基线，不是 infra platform baseline
- 当前 secret contract 仍依赖 env discipline，不是 centralized secret-management platform
- 当前 tenant isolation 仍主要依赖 application-layer `workspace` scoping
- 当前 rollback 仍不是 automated rollback plane

## 10. 对外诚实口径

当前可以诚实表述为：

- Helm 已经具备受控部署所需的应用层 baseline contract
- Helm 已经把 environment matrix、config / secret contract、build / test / release / rollback wording 冻结为可审阅真值
- Helm 已经有 repo-level validation workflow，覆盖 core validation gates
- Helm 已经具备 future enterprise identity integration 的应用侧前置条件
- Helm 仍没有 Docker / Kubernetes / deploy pipeline implementation，也仍不是 full enterprise IAM

## 11. 下一层最该做的事

下一层优先顺序保持为：

1. auth anomaly follow-through richer review
2. broader session governance / revoke scope refinement
3. deploy baseline contract follow-through deeper slice
4. tenant data governance hardening
5. enterprise integration seams 只在真实需求下再评估
