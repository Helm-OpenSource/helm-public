---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Identity And Read-only Connector Plan V1

更新时间：2026-04-06
结论：Completed

## 1. 目标

PR73 只做 DingTalk identity/read-only connector foundation：

1. `DINGTALK_OAUTH` provider seam
2. DingTalk connector/import enum truth
3. DingTalk env/config/readiness helper
4. settings/operator readout
5. directory-sync adapter seam truth
6. baseline / report / README / docs / guards

它不是：

- native DingTalk SCIM
- DingTalk OAuth login/callback runtime
- DingTalk meetings/calendar/message notifications ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / CI implementation
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- auth provider seam
- connector/import governance seam

当前本轮已补齐：

- `DINGTALK_OAUTH`
- `DINGTALK`
- DingTalk config / readiness helper
- settings reserved connector readout
- `.env.example` DingTalk env contract

当前仍未成立：

- native DingTalk SCIM
- DingTalk OAuth runtime
- DingTalk read-only sync runtime

## 3. 本轮要证明什么

1. Helm 可以先把 DingTalk identity/read-only connector foundation 收成 honest truth
2. Helm directory-sync adapter seam 可以被显式表达，而不把 native DingTalk SCIM 写成已成立
3. 当前 read-only connector 只冻结到 `meetings / calendar / message notifications`

## 4. 精确闭环

`provider seam -> env/config contract -> connector/import enum truth -> settings/operator readout -> docs/guard truth`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current DingTalk line remains foundation-only

## 6. 范围

- `lib/auth/provider-seam.ts`
- `lib/connectors/dingtalk.ts`
- `lib/connectors/dingtalk.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/202604060002_dingtalk_identity_foundation/migration.sql`
- `app/(workspace)/settings/page.tsx`
- `features/settings/settings-client.tsx`
- `.env.example`
- PR73 baseline / report / README / docs / guards

## 7. 不做

- native DingTalk SCIM claim
- DingTalk OAuth runtime
- DingTalk read-only ingestion runtime
- send/write-back connector path
- Docker / Kubernetes / CI implementation

## 8. 风险

1. 官方接口细节如果没有在仓库内落实，不应被文档过度声称
2. 如果把 directory-sync seam 写成 SCIM implementation，会越过当前 truth
3. 如果不更新 guards，后续仓库会误把 DingTalk line 写成 broader platform capability

## 9. 阶段计划

### Phase 0

- 复核 provider/config/connector truth
- 冻结 PR73 计划
- 状态：Completed

### Phase 1

- 完成 DingTalk foundation slice
- baseline / report / index / guards
- targeted tests
- 状态：Completed

### Phase 2

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
